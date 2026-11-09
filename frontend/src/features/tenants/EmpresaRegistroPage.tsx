import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';

interface PlanInfo { code: string; name: string; priceMonthly: string; maxBranches: number; aiGenerativeReports: boolean; }

const STEPS = ['Plan', 'Empresa', 'Verificar correo', 'Pago'] as const;

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,.08)', maxWidth: 560, width: '100%' };
const errBox: React.CSSProperties = { color: '#991b1b', background: '#fee2e2', padding: 10, borderRadius: 8, margin: '12px 0', fontSize: '.9rem' };
const okBox: React.CSSProperties = { color: '#065f46', background: '#d1fae5', padding: 10, borderRadius: 8, margin: '12px 0', fontSize: '.9rem' };

const errMsg = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || fallback;
};

export const EmpresaRegistroPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const preselected: string = (useLocation().state as any)?.plan?.code ?? '';

  const [step, setStep] = useState(preselected ? 1 : 0);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [planCode, setPlanCode] = useState(preselected);
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [card_, setCard] = useState({ cardHolder: '', cardNumber: '', expiry: '', cvv: '' });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/saas/plans').then((r) => setPlans(r.data)).catch(() => setError('No se pudieron cargar los planes.'));
  }, []);

  useEffect(() => {
    if (!companyName.trim()) { setSlug(''); return; }
    const t = setTimeout(() => {
      api.post('/saas/register/check', { name: companyName }).then((r) => setSlug(r.data.slug)).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [companyName]);

  const plan = plans.find((p) => p.code === planCode);
  const run = async (fn: () => Promise<void>) => {
    setError(null); setInfo(null); setLoading(true);
    try { await fn(); } catch (e) { setError(errMsg(e, 'Ocurrió un error. Intenta nuevamente.')); } finally { setLoading(false); }
  };

  const submitCompany = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const chk = await api.post('/saas/register/check', { name: companyName, email: adminEmail });
      if (chk.data.emailTaken) throw { response: { data: { message: 'Ese correo ya está registrado. Inicia sesión o usa otro correo.' } } };
      setSlug(chk.data.slug);
      await sendCode();
      setStep(2);
    });
  };

  const sendCode = async () => {
    const r = await api.post('/saas/register/send-code', { email: adminEmail });
    setInfo(r.data.message);
    setDevCode(r.data.devCode ?? null);
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api.post('/saas/register/verify-code', { email: adminEmail, code });
      setVerificationToken(r.data.verificationToken);
      setStep(3);
    });
  };

  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api.post('/saas/register/complete', {
        companyName, taxId: taxId || undefined, planCode, adminName, adminEmail, password, verificationToken, payment: card_,
      });
      login(r.data.accessToken, r.data.user);
      navigate('/dashboard');
    });
  };

  const field = (label: string, value: string, set: (v: string) => void, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="input-group">
      <label htmlFor={`f-${label}`}>{label}</label>
      <input id={`f-${label}`} value={value} onChange={(e) => set(e.target.value)} {...props} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>Registrar mi empresa</h2>
        <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: '0 0 16px', fontSize: '.8rem' }}>
          {STEPS.map((s, i) => (
            <li key={s} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 6, background: i === step ? '#111827' : i < step ? '#d1fae5' : '#e5e7eb', color: i === step ? '#fff' : '#374151' }}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {error && <div style={errBox}>{error}</div>}
        {info && <div style={okBox}>{info}</div>}

        {step === 0 && (
          <div>
            <p>Elige el plan de tu empresa:</p>
            <div style={{ display: 'grid', gap: 12 }}>
              {plans.map((p) => (
                <label key={p.code} style={{ border: planCode === p.code ? '2px solid #111827' : '1px solid #d1d5db', borderRadius: 10, padding: 14, cursor: 'pointer', display: 'block' }}>
                  <input type="radio" name="plan" checked={planCode === p.code} onChange={() => setPlanCode(p.code)} /> <strong>{p.name}</strong> — ${Number(p.priceMonthly).toFixed(0)}/mes
                  <div style={{ fontSize: '.85rem', color: '#6b7280', marginLeft: 22 }}>
                    Hasta {p.maxBranches} sucursales{p.aiGenerativeReports ? ' · Reportes con IA' : ''}
                  </div>
                </label>
              ))}
            </div>
            <button className="btn-login" style={{ marginTop: 16 }} disabled={!planCode} onClick={() => setStep(1)}>Continuar</button>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={submitCompany}>
            {field('Nombre de la empresa', companyName, setCompanyName, { required: true, placeholder: 'Mi Tienda S.R.L.' })}
            {slug && <p style={{ fontSize: '.85rem', color: '#6b7280', marginTop: -6 }}>URL asignada (única): <strong>{slug}</strong></p>}
            {field('NIT (opcional)', taxId, setTaxId)}
            {field('Nombre del administrador', adminName, setAdminName, { required: true })}
            {field('Correo del administrador', adminEmail, setAdminEmail, { type: 'email', required: true, placeholder: 'correo@ejemplo.com' })}
            {field('Contraseña', password, setPassword, { type: 'password', required: true, minLength: 6, placeholder: 'Mínimo 6 caracteres' })}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-login" style={{ background: '#6b7280' }} onClick={() => setStep(0)}>Atrás</button>
              <button type="submit" className="btn-login" disabled={loading}>{loading ? 'Enviando código...' : 'Enviar código al correo'}</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verify}>
            <p>Enviamos un código de 6 dígitos a <strong>{adminEmail}</strong>. Verificamos tu correo antes de cobrar.</p>
            {devCode && <div style={okBox}>Modo desarrollo (sin SMTP): tu código es <strong>{devCode}</strong></div>}
            {field('Código de verificación', code, setCode, { required: true, inputMode: 'numeric', maxLength: 6, placeholder: '123456' })}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-login" style={{ background: '#6b7280' }} onClick={() => setStep(1)}>Atrás</button>
              <button type="button" className="btn-login" style={{ background: '#6b7280' }} disabled={loading} onClick={() => run(sendCode)}>Reenviar</button>
              <button type="submit" className="btn-login" disabled={loading || code.length !== 6}>Verificar</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={pay}>
            <p>Plan <strong>{plan?.name}</strong> — total a pagar: <strong>${Number(plan?.priceMonthly ?? 0).toFixed(2)}</strong> (pago simulado, no se guarda la tarjeta).</p>
            {field('Titular de la tarjeta', card_.cardHolder, (v) => setCard({ ...card_, cardHolder: v }), { required: true })}
            {field('Número de tarjeta', card_.cardNumber, (v) => setCard({ ...card_, cardNumber: v }), { required: true, inputMode: 'numeric', placeholder: '4111 1111 1111 1111' })}
            <div style={{ display: 'flex', gap: 8 }}>
              {field('Vence (MM/AA)', card_.expiry, (v) => setCard({ ...card_, expiry: v }), { required: true, placeholder: '12/30', maxLength: 5 })}
              {field('CVV', card_.cvv, (v) => setCard({ ...card_, cvv: v }), { required: true, inputMode: 'numeric', maxLength: 4 })}
            </div>
            <button type="submit" className="btn-login" disabled={loading}>{loading ? 'Procesando pago...' : `Pagar y crear empresa`}</button>
          </form>
        )}

        <p style={{ fontSize: '.85rem', marginTop: 16, textAlign: 'center' }}>¿Ya tienes cuenta? <a href="/login">Inicia sesión</a></p>
      </div>
    </div>
  );
};
