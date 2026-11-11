/**
 * BILLING SERVICE: cobro de la suscripción de la empresa con Stripe Checkout.
 *
 *  - Con STRIPE_SECRET_KEY configurada el cambio/renovación de un plan de pago exige pagar en Stripe.
 *  - El plan solo se aplica cuando el pago está CONFIRMADO: se consulta la sesión directamente a Stripe
 *    (nunca se confía en lo que diga el navegador) y la operación es idempotente por id de sesión.
 *  - Sin clave de Stripe el sistema trabaja en modo SIMULADO (desarrollo/demostración) y lo declara en la respuesta.
 */
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Stripe from 'stripe';
import { Plan } from './plan.entity';
import { TenantsService } from './tenants.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    private readonly tenants: TenantsService,
    private readonly dataSource: DataSource,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key && /^sk_(test|live)_/.test(key) && key !== 'sk_test_mock') {
      // STRIPE_API_HOST/PORT/PROTOCOL: solo para pruebas automáticas contra un Stripe simulado (scripts/mock-stripe.js)
      const test = process.env.STRIPE_API_HOST
        ? { host: process.env.STRIPE_API_HOST, port: process.env.STRIPE_API_PORT, protocol: (process.env.STRIPE_API_PROTOCOL || 'http') as 'http' | 'https' }
        : {};
      this.stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' as any, ...test });
    }
  }

  /** Moneda de cobro de las suscripciones (los precios de los planes están en dólares por defecto). */
  private currency() { return (process.env.STRIPE_PLAN_CURRENCY || 'usd').toLowerCase(); }

  isEnabled() { return !!this.stripe; }

  config() {
    return { stripeEnabled: this.isEnabled(), currency: this.currency().toUpperCase(), mode: this.isEnabled() ? 'STRIPE' : 'SIMULADO' };
  }

  /**
   * Inicia el cambio/renovación de plan.
   *  - Plan gratuito: se aplica directamente.
   *  - Plan de pago con Stripe: devuelve la URL de Stripe Checkout (el plan se aplica al confirmarse el pago).
   *  - Plan de pago sin Stripe configurado: se aplica en modo simulado.
   */
  async startCheckout(tenantId: number, planCode: string, billingCycle?: string) {
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan) throw new NotFoundException(`Plan ${planCode} no existe`);
    const cycle = billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
    const free = Number(plan.priceMonthly) === 0;

    if (free || !this.stripe) {
      const tenant = await this.tenants.changePlan(tenantId, planCode, cycle, free ? 'ADMIN' : 'ADMIN (simulado)');
      return { mode: free ? 'direct' : 'simulated', tenant };
    }

    // Se valida ANTES de cobrar que la empresa cabe en el plan destino
    await this.tenants.assertWithinPlan(tenantId, plan);

    const amount = TenantsService.price(plan, cycle);
    const [tn] = await this.dataSource.query('SELECT name, slug FROM tenants WHERE id = $1', [tenantId]);
    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const metadata = { type: 'PLAN', tenantId: String(tenantId), planCode: plan.code, billingCycle: cycle };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: this.currency(),
          unit_amount: Math.round(amount * 100),
          product_data: { name: `DRESSED · ${plan.name} (${cycle === 'YEARLY' ? 'anual' : 'mensual'})`, description: tn?.name ? `Suscripción de ${tn.name}` : undefined },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${base}/dashboard/subscription?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard/subscription?paid=0`,
    });
    return { mode: 'stripe', url: session.url, sessionId: session.id };
  }

  /**
   * Confirma un pago de plan y aplica la suscripción. Idempotente (una sesión solo se aplica una vez)
   * y a prueba de manipulación: el monto y la empresa se verifican contra la sesión real de Stripe.
   */
  async confirm(tenantId: number, sessionId: string) {
    if (!this.stripe) throw new BadRequestException('Los pagos con Stripe no están configurados.');
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId || '')) throw new BadRequestException('Sesión de pago inválida');
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    return this.applySession(session, tenantId);
  }

  private async applySession(session: Stripe.Checkout.Session, expectedTenantId?: number) {
    const m = session.metadata ?? {};
    if (m.type !== 'PLAN') throw new BadRequestException('La sesión no corresponde a un pago de plan');
    const tenantId = Number(m.tenantId);
    if (expectedTenantId && tenantId !== expectedTenantId) throw new ForbiddenException('Ese pago pertenece a otra empresa');
    if (session.payment_status !== 'paid') throw new HttpException('El pago aún no está confirmado', HttpStatus.PAYMENT_REQUIRED);

    const plan = await this.planRepo.findOne({ where: { code: m.planCode } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    const cycle = m.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
    const expected = Math.round(TenantsService.price(plan, cycle) * 100);
    if (session.amount_total !== expected) {
      this.logger.error(`Monto inesperado en ${session.id}: ${session.amount_total} vs ${expected}`);
      throw new BadRequestException('El monto pagado no coincide con el precio del plan');
    }

    // Idempotencia: ya aplicada
    const done = await this.dataSource.query(
      `SELECT 1 FROM subscription_history WHERE tenant_id = $1 AND notes LIKE $2 LIMIT 1`, [tenantId, `%${session.id}%`]);
    if (done.length) return { applied: false, tenant: await this.tenants.getMyTenant(tenantId) };

    const tenant = await this.tenants.changePlan(tenantId, plan.code, cycle, `STRIPE ${session.id}`);
    return { applied: true, tenant };
  }

  /** Webhook firmado: aplica el plan aunque el usuario cierre el navegador antes de volver. */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!this.stripe || !secret) throw new BadRequestException('Webhook no configurado');
    if (!rawBody || !signature) throw new BadRequestException('Falta la firma de Stripe');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err: any) {
      throw new BadRequestException(`Firma inválida: ${err.message}`);
    }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === 'PLAN') await this.applySession(session);
    }
    return { received: true };
  }

  /** Para impedir que se salte el cobro con el endpoint antiguo de cambio de plan. */
  requiresPayment(plan: Plan) { return this.isEnabled() && Number(plan.priceMonthly) > 0; }
}
