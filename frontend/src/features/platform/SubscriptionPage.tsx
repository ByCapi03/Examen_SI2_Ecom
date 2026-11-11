import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/axios';
import { DashStyles, PageHeader, Card } from '../../components/dashboard/ui';
import { money, limitText, fmtDate, STATUS_LABEL, price, yearlySaving } from './planUtils';
import type { PlanInfo, Cycle } from './planUtils';

interface Me {
  plan: PlanInfo | null;
  subscription: { status: string; billingCycle: Cycle; startDate: string; endDate: string | null; daysLeft: number | null } | null;
  usage: { branches: number; products: number; users: number };
}

const Bar = ({ label, used, max }: { label: string; used: number; max: number | null }) => {
  const pct = max ? Math.min(100, (used / max) * 100) : 8;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 5 }}>
        <span style={{ fontWeight: 600 }}>{label}</span><span>{used} / {max ?? 'ilimitado'}</span>
      </div>
      <div style={{ height: 8, background: 'var(--chart-track, #EEEAE1)', borderRadius: 5 }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 5, background: max && used >= max ? '#C2410C' : 'var(--atemporal-gold)' }} />
      </div>
    </div>
  );
};

/** El administrador ve su plan, vigencia y consumo, y puede cambiar de plan o renovar (mensual/anual). */
export const SubscriptionPage = () => {
  const [me, setMe] = useState<Me | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [billing, setBilling] = useState<{ stripeEnabled: boolean; mode: string; currency: string } | null>(null);
  const [params, setParams] = useSearchParams();

  const load = async () => {
    const [m, p] = await Promise.all([api.get('/saas/tenants/me'), api.get('/saas/plans')]);
    setMe(m.data); setPlans(p.data);
    if (m.data.subscription?.billingCycle) setCycle(m.data.subscription.billingCycle);
  };
  useEffect(() => { void load().catch(() => setMsg({ ok: false, text: 'No se pudo cargar tu suscripción.' })); }, []);
  useEffect(() => { api.get('/saas/billing/config').then((r) => setBilling(r.data)).catch(() => {}); }, []);

  // Regreso desde Stripe Checkout: se confirma el pago en el servidor (que lo verifica con Stripe)
  useEffect(() => {
    const paid = params.get('paid');
    const sessionId = params.get('session_id');
    if (paid === null) return;
    setParams({}, { replace: true });
    if (paid === '0') { setMsg({ ok: false, text: 'El pago fue cancelado. Tu plan no cambió.' }); return; }
    if (!sessionId) return;
    setBusy('confirm');
    api.post('/saas/billing/confirm', { sessionId })
      .then(async (r) => { await load(); setMsg({ ok: true, text: r.data?.applied === false ? 'Este pago ya estaba aplicado.' : '¡Pago recibido! Tu plan fue actualizado.' }); })
      .catch((e) => setMsg({ ok: false, text: e.response?.data?.message || 'No pudimos confirmar el pago. Si te cobraron, contacta a soporte.' }))
      .finally(() => setBusy(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (code: string) => {
    setBusy(code); setMsg(null);
    try {
      const { data } = await api.post('/saas/billing/checkout', { planCode: code, billingCycle: cycle });
      if (data.mode === 'stripe' && data.url) { window.location.href = data.url; return; } // pago real en Stripe
      await load();
      setMsg({ ok: true, text: data.mode === 'simulated' ? 'Plan actualizado (modo simulado: no se realizó ningún cobro).' : 'Plan actualizado correctamente.' });
    } catch (e: any) { setMsg({ ok: false, text: e.response?.data?.message || 'No se pudo cambiar el plan.' }); }
    finally { setBusy((b) => (b === code ? '' : b)); }
  };

  const sub = me?.subscription;
  const st = STATUS_LABEL[sub?.status ?? 'ACTIVE'] ?? STATUS_LABEL.ACTIVE;
  const cur = me?.plan;

  return (
    <div className="dz-page">
      <DashStyles />
      <PageHeader title="Mi suscripción" subtitle="Plan contratado, vigencia, consumo y cambio de plan" />
      {billing && (
        <div style={{ marginBottom: 12, fontSize: '0.78rem', color: billing.stripeEnabled ? '#15803D' : '#92400e' }}>
          {billing.stripeEnabled ? `🔒 Pago seguro con tarjeta (Stripe, ${billing.currency}).` : '⚠️ Modo simulado: los cambios de plan no generan cobro real.'}
        </div>
      )}
      {busy === 'confirm' && <div style={{ padding: 10, borderRadius: 8, marginBottom: 14, fontSize: '0.86rem', background: '#e0f2fe', color: '#075985' }}>Confirmando tu pago…</div>}
      {msg && <div style={{ padding: 10, borderRadius: 8, marginBottom: 14, fontSize: '0.86rem', background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#166534' : '#991b1b' }}>{msg.text}</div>}

      <div className="dz-grid dz-2-1" style={{ marginBottom: 18 }}>
        <Card title={cur ? cur.name : 'Plan'} subtitle={sub ? `${sub.billingCycle === 'YEARLY' ? 'Facturación anual' : 'Facturación mensual'}` : undefined}
          actions={sub && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 700, background: st.bg, color: st.fg }}>{st.text}</span>}>
          {sub && (
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: '0.88rem' }}>
              <div><div style={{ color: 'var(--atemporal-muted)', fontSize: '0.72rem' }}>INICIO</div><b>{fmtDate(sub.startDate)}</b></div>
              <div><div style={{ color: 'var(--atemporal-muted)', fontSize: '0.72rem' }}>VENCE</div><b>{sub.endDate ? fmtDate(sub.endDate) : 'Sin vencimiento'}</b></div>
              {sub.daysLeft != null && <div><div style={{ color: 'var(--atemporal-muted)', fontSize: '0.72rem' }}>RESTAN</div><b style={{ color: sub.daysLeft <= 7 ? '#C2410C' : undefined }}>{sub.daysLeft > 0 ? `${sub.daysLeft} días` : 'Vencida'}</b></div>}
            </div>
          )}
        </Card>
        <Card title="Consumo del plan">
          {me && cur && <>
            <Bar label="Sucursales" used={me.usage.branches} max={cur.maxBranches >= 99 ? null : cur.maxBranches} />
            <Bar label="Productos" used={me.usage.products} max={cur.maxProducts} />
            <Bar label="Usuarios internos" used={me.usage.users} max={cur.maxUsers} />
          </>}
        </Card>
      </div>

      <Card title="Cambiar de plan o renovar" subtitle="Al elegir un plan se reinicia el período según el ciclo"
        actions={
          <div className="dz-tabs">
            <button className={`dz-tab${cycle === 'MONTHLY' ? ' on' : ''}`} onClick={() => setCycle('MONTHLY')}>Mensual</button>
            <button className={`dz-tab${cycle === 'YEARLY' ? ' on' : ''}`} onClick={() => setCycle('YEARLY')}>Anual · 2 meses gratis</button>
          </div>}>
        <div className="dz-grid dz-1-1-1">
          {plans.map((p) => {
            const isCur = cur?.code === p.code;
            const free = Number(p.priceMonthly) === 0;
            return (
              <div key={p.code} style={{ border: `2px solid ${isCur ? 'var(--atemporal-gold)' : 'var(--atemporal-border)'}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontWeight: 800 }}>{p.name}{isCur && <span style={{ marginLeft: 8, fontSize: '0.68rem', color: 'var(--atemporal-gold)' }}>ACTUAL</span>}</div>
                <div style={{ margin: '8px 0', fontSize: '1.5rem', fontWeight: 900 }}>
                  {free ? 'Gratis' : money(price(p, cycle))}<span style={{ fontSize: '0.78rem', fontWeight: 500, opacity: 0.6 }}>{free ? '' : cycle === 'YEARLY' ? ' /año' : ' /mes'}</span>
                </div>
                {!free && cycle === 'YEARLY' && <div style={{ fontSize: '0.74rem', color: '#15803D', marginBottom: 6 }}>Ahorras {money(yearlySaving(p))} al año</div>}
                <ul style={{ margin: '8px 0 12px', paddingLeft: 18, fontSize: '0.8rem', lineHeight: 1.6 }}>
                  <li>{limitText(p.maxBranches, 'sucursales')}</li><li>{limitText(p.maxProducts, 'productos')}</li><li>{limitText(p.maxUsers, 'usuarios internos')}</li>
                  <li>{p.aiGenerativeReports ? 'Reportes IA y analítica ML' : free ? 'Sin reportes' : 'Reportes básicos'}</li>
                </ul>
                <button className="dz-btn" style={{ width: '100%' }} disabled={!!busy || (isCur && free)} onClick={() => choose(p.code)}>
                  {busy === p.code ? 'Procesando…' : free ? (isCur ? 'Plan actual' : 'Cambiar a gratis') : billing?.stripeEnabled ? (isCur ? 'Renovar y pagar' : 'Pagar con tarjeta') : (isCur ? 'Renovar' : 'Elegir plan')}
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
