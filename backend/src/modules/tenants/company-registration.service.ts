import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailService } from '../../common/mail.service';
import { User } from '../auth/user.entity';
import { Role } from '../auth/role.entity';
import { UserRole } from '../auth/user-role.entity';
import { Tenant } from './tenant.entity';
import { Plan } from './plan.entity';
import { Subscription } from './subscription.entity';
import { SubscriptionHistory } from './subscription-history.entity';
import { RegistrationVerification } from './registration-verification.entity';
import { seedDefaultCatalog } from './default-catalog';

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SEC = 30;

export interface CompleteRegistrationDto {
  companyName: string;
  taxId?: string;
  planCode: string;
  adminName: string;
  adminEmail: string;
  password: string;
  verificationToken: string;
  payment: { cardHolder: string; cardNumber: string; expiry: string; cvv: string };
}

export const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'empresa';

const luhn = (num: string): boolean => {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = +num[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return sum % 10 === 0;
};

@Injectable()
export class CompanyRegistrationService {
  private readonly logger = new Logger(CompanyRegistrationService.name);

  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(Plan) private planRepo: Repository<Plan>,
    @InjectRepository(RegistrationVerification) private verifRepo: Repository<RegistrationVerification>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  /** Devuelve un slug libre: mi-empresa, mi-empresa-2, mi-empresa-3... */
  async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base, n = 1;
    while (await this.tenantRepo.exists({ where: { slug: candidate } })) {
      n++;
      candidate = `${base}-${n}`;
    }
    return candidate;
  }

  async checkAvailability(name: string) {
    const slug = await this.uniqueSlug(name || '');
    return { slug };
  }

  async sendCode(rawEmail: string) {
    const email = (rawEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Correo electrónico inválido.');
    const last = await this.verifRepo.findOne({ where: { email }, order: { createdAt: 'DESC' } });
    if (last && !last.used && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_SEC * 1000) {
      throw new BadRequestException(`Espera ${RESEND_COOLDOWN_SEC} segundos antes de pedir otro código.`);
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    await this.verifRepo.save(this.verifRepo.create({
      email,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60000),
    }));

    let delivered = true;
    try {
      await this.mail.sendActivationCode(email, 'futuro administrador', code);
    } catch {
      delivered = false;
      this.logger.warn(`SMTP no disponible; código de verificación para ${email}: ${code}`);
    }
    const exposeCode = !delivered && process.env.NODE_ENV !== 'production';
    return {
      message: delivered
        ? `Código enviado a ${email}. Válido por ${CODE_TTL_MIN} minutos.`
        : 'No se pudo enviar el correo (SMTP no configurado). Modo desarrollo: usa el código mostrado.',
      ...(exposeCode ? { devCode: code } : {}),
    };
  }

  async verifyCode(rawEmail: string, code: string) {
    const email = (rawEmail || '').trim().toLowerCase();
    const v = await this.verifRepo.findOne({ where: { email, used: false }, order: { createdAt: 'DESC' } });
    if (!v) throw new BadRequestException('Primero solicita un código de verificación.');
    if (v.expiresAt.getTime() < Date.now()) throw new BadRequestException('El código expiró. Solicita uno nuevo.');
    if (v.attempts >= MAX_ATTEMPTS) throw new BadRequestException('Demasiados intentos. Solicita un código nuevo.');

    if (!(await bcrypt.compare(String(code || '').trim(), v.codeHash))) {
      v.attempts++;
      await this.verifRepo.save(v);
      throw new BadRequestException(`Código incorrecto. Intentos restantes: ${MAX_ATTEMPTS - v.attempts}.`);
    }
    v.used = true;
    await this.verifRepo.save(v);
    const verificationToken = this.jwt.sign({ purpose: 'company-registration', email }, { expiresIn: '30m' });
    return { verified: true, verificationToken };
  }

  private validatePayment(p: CompleteRegistrationDto['payment']) {
    const num = (p?.cardNumber || '').replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(num) || !luhn(num)) throw new BadRequestException('Número de tarjeta inválido.');
    const m = /^(\d{2})\/(\d{2})$/.exec(p?.expiry || '');
    if (!m || +m[1] < 1 || +m[1] > 12) throw new BadRequestException('Fecha de vencimiento inválida (MM/AA).');
    const exp = new Date(2000 + +m[2], +m[1], 1);
    if (exp.getTime() <= Date.now()) throw new BadRequestException('La tarjeta está vencida.');
    if (!/^\d{3,4}$/.test(p?.cvv || '')) throw new BadRequestException('CVV inválido.');
    if (!(p?.cardHolder || '').trim()) throw new BadRequestException('Ingresa el titular de la tarjeta.');
    return num.slice(-4);
  }

  async complete(dto: CompleteRegistrationDto) {
    const email = (dto.adminEmail || '').trim().toLowerCase();
    if (!dto.companyName?.trim()) throw new BadRequestException('El nombre de la empresa es obligatorio.');
    if (!dto.adminName?.trim()) throw new BadRequestException('El nombre del administrador es obligatorio.');
    if ((dto.password || '').length < 6) throw new BadRequestException('La contraseña debe tener al menos 6 caracteres.');

    let payload: any;
    try { payload = this.jwt.verify(dto.verificationToken); } catch {
      throw new BadRequestException('La verificación del correo expiró. Verifica tu correo nuevamente.');
    }
    if (payload.purpose !== 'company-registration' || payload.email !== email) {
      throw new BadRequestException('El correo no coincide con el verificado.');
    }

    const plan = await this.planRepo.findOne({ where: { code: dto.planCode } });
    if (!plan) throw new NotFoundException(`El plan ${dto.planCode} no existe.`);
    // Pago simulado: se valida el formato, no se almacena ningún dato de la tarjeta.
    const last4 = this.validatePayment(dto.payment);

    const result = await this.dataSource.transaction(async (em) => {
      let slug = await this.uniqueSlug(dto.companyName);
      let tenant: Tenant;
      try {
        tenant = await em.save(Tenant, em.create(Tenant, { name: dto.companyName.trim(), slug, taxId: dto.taxId?.trim() || undefined, active: true }));
      } catch (e: any) {
        if (e.code === '23505') throw new ConflictException('No se pudo reservar la URL de la empresa, intenta nuevamente.');
        throw e;
      }
      await em.save(Subscription, em.create(Subscription, { tenantId: tenant.id, planId: plan.id, status: 'ACTIVE', startDate: new Date() }));
      await em.save(SubscriptionHistory, em.create(SubscriptionHistory, {
        tenantId: tenant.id, planId: plan.id, action: 'SUBSCRIBE', notes: `Alta con pago simulado tarjeta ****${last4}`,
      }));
      await seedDefaultCatalog(em, tenant.id);

      const role = await em.findOne(Role, { where: { name: 'ADMIN' } });
      if (!role) throw new BadRequestException('El rol ADMIN no existe; ejecuta los seeds.');
      const user = await em.save(User, em.create(User, {
        tenantId: tenant.id, name: dto.adminName.trim(), email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        active: true, mustChangePassword: false, temporaryPasswordExpiresAt: null, emailVerified: true,
      }));
      await em.save(UserRole, em.create(UserRole, { userId: user.id, roleId: role.id, active: true }));
      return { tenant, user, roleName: role.name };
    });

    const roles = [result.roleName];
    const accessToken = this.jwt.sign({
      sub: result.user.id, email, roles, branchId: null, tenantId: result.tenant.id,
    });
    return {
      accessToken,
      user: { id: result.user.id, name: result.user.name, email, roles, branchId: null, tenantId: result.tenant.id, mustChangePassword: false },
      tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
      plan: { code: plan.code, name: plan.name },
    };
  }
}
