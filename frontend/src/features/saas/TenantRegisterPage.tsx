import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';

interface Plan {
  id: number; code: string; name: string;
  priceMonthly: number; priceYearly?: number; maxBranches: number; aiGenerativeReports: boolean;
}

type Step = 'form' | 'payment' | 'verify' | 'success';

const slugify = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const fmtCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const fmtExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };

/* ── Reusable field ── */
const Field = ({ label, value, onChange, placeholder, type = 'text', hint, prefix, maxLen }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string; prefix?: string; maxLen?: number;
}) => {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? 'var(--atemporal-gold,#C9904A)' : '#d1d5db';
  const shadow = focused ? '0 0 0 3px rgba(201,144,74,0.14)' : 'none';
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      <div style={{ display: 'flex', border: `1.5px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: shadow, transition: 'all 0.15s' }}>
        {prefix && <span style={{ padding: '10px 10px', background: '#f9fafb', color: '#9ca3af', fontSize: '0.78rem', borderRight: '1.5px solid #e5e7eb', whiteSpace: 'nowrap', userSelect: 'none' }}>{prefix}</span>}
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} maxLength={maxLen}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, border: 'none', outline: 'none', padding: '11px 13px', fontSize: '0.88rem', background: 'transparent', fontFamily: type === 'tel' ? 'monospace' : "'Outfit',sans-serif" }}
        />
      </div>
      {hint && <p style={{ margin: '4px 0 0', fontSize: '0.73rem', color: '#9ca3af' }}>{hint}</p>}
    </div>
  );
};

const Chk = ({ c = '#22c55e' }: { c?: string }) => (
  <svg width="14" height="14" fill="none" stroke={c} strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
  </svg>
);

export const TenantRegisterPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const plan: Plan | null = (location.state as any)?.plan ?? null;
  const cycle: 'MONTHLY' | 'YEARLY' = (location.state as any)?.cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
  const planPrice = plan ? (cycle === 'YEARLY' ? Number(plan.priceYearly ?? plan.priceMonthly * 10) : plan.priceMonthly) : 0;

  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  /* form fields */
  const [bizName, setBizName] = useState('');
  const [slug, setSlug] = useState('');
  const [taxId, setTaxId] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminPass2, setAdminPass2] = useState('');

  /* card fields */
  const [cardNum, setCardNum] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const [result, setResult] = useState<any>(null);

  /* verificación de correo */
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [info, setInfo] = useState('');

  useEffect(() => { if (!plan) navigate('/pricing'); }, [plan, navigate]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => { setSlug(slugify(bizName)); }, [bizName]);

  if (!plan) return null;
  const isFree = Number(plan.priceMonthly) === 0;

  const doRegister = async () => {
    setBusy(true); setErr('');
    try {
      if (!isFree) await new Promise(r => setTimeout(r, 1800));
      const { data } = await api.post('/saas/tenants/register', {
        name: bizName.trim(), slug: slug.trim(),
        taxId: taxId.trim() || undefined, planCode: plan.code, billingCycle: cycle,
        adminName: adminName.trim(), adminEmail: adminEmail.trim(), adminPassword: adminPass,
      });
      setResult(data);
      if (data.requiresVerification) {
        setEmailSent(data.emailSent !== false);
        setDevCode(data.devCode ?? null);
        setCooldown(60);
        setStep('verify');
      } else {
        setStep('success');
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo crear la empresa. Verifica que el slug y el correo no estén en uso.');
    } finally { setBusy(false); }
  };

  const handleForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !slug.trim() || !adminName.trim() || !adminEmail.trim() || !adminPass) { setErr('Completa todos los campos obligatorios.'); return; }
    if (adminPass !== adminPass2) { setErr('Las contraseñas no coinciden.'); return; }
    if (adminPass.length < 6) { setErr('La contraseña debe tener al menos 6 caracteres.'); return; }
    setErr('');
    if (isFree) doRegister(); else setStep('payment');
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setErr('Ingresa el código de 6 dígitos.'); return; }
    setBusy(true); setErr(''); setInfo('');
    try {
      const { data } = await api.post('/saas/tenants/verify-email', { email: adminEmail.trim(), code });
      login(data.accessToken, data.user);
      setResult((r: any) => ({ ...r, tenant: data.tenant }));
      setStep('success');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo verificar el código.');
    } finally { setBusy(false); }
  };

  const handleResend = async () => {
    setErr(''); setInfo('');
    try {
      const { data } = await api.post('/saas/tenants/resend-code', { email: adminEmail.trim() });
      setEmailSent(data.emailSent !== false);
      setDevCode(data.devCode ?? null);
      setCooldown(60);
      setInfo('Te enviamos un nuevo código.');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo reenviar el código.');
    }
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNum.replace(/\s/g,'').length < 16 || expiry.length < 5 || cvc.length < 3 || !cardHolder.trim()) { setErr('Completa todos los datos de la tarjeta.'); return; }
    setErr('');
    doRegister();
  };

  /* ─── Layout helpers ─── */
  const G = 'var(--atemporal-green,#182D2A)';
  const Au = 'var(--atemporal-gold,#C9904A)';
  const Cr = 'var(--atemporal-cream,#F5F2EB)';

  /* ─── SUCCESS ─── */
  if (step === 'success') {
    return (
      <div style={{ minHeight:'100vh', background: Cr, display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'Outfit',sans-serif" }}>
        <div style={{ background:'#fff', borderRadius:20, boxShadow:'0 8px 48px rgba(0,0,0,0.12)', maxWidth:480, width:'100%', padding:'48px 40px', textAlign:'center' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#d1fae5,#bbf7d0)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
            <svg width="32" height="32" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 style={{ margin:'0 0 6px', fontSize:'1.6rem', fontWeight:800, color: G }}>¡Empresa activada!</h2>
          {!isFree && <p style={{ color:'#16a34a', fontWeight:600, fontSize:'0.88rem', margin:'0 0 20px' }}>✓ Pago de ${planPrice}{cycle === 'YEARLY' ? '/año' : '/mes'} procesado</p>}

          <div style={{ background: Cr, borderRadius:14, padding:'20px 24px', textAlign:'left', marginBottom:24, border:'1px solid #e8e3d9' }}>
            {[
              ['Empresa', result?.tenant?.name ?? bizName],
              ['Plan', result?.plan?.name ?? plan.name],
              ['Administrador', adminEmail],
            ].map(([l,v]) => (
              <div key={l} style={{ marginBottom:12 }}>
                <span style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'#9ca3af', fontWeight:600 }}>{l}</span>
                <p style={{ margin:'3px 0 0', fontWeight:600, color: G }}>{v}</p>
              </div>
            ))}
            <div>
              <span style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'#9ca3af', fontWeight:600 }}>Slug / URL</span>
              <p style={{ margin:'5px 0 0', fontFamily:'monospace', fontSize:'0.9rem', background:'#fff', border:'1px solid #e8e3d9', padding:'6px 12px', borderRadius:8, color: Au, fontWeight:700 }}>
                {result?.tenant?.slug ?? slug}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            style={{ width:'100%', padding:'14px 0', background: G, color:'#fff', border:'none', borderRadius:12, fontWeight:700, fontSize:'0.92rem', cursor:'pointer', marginBottom:12 }}
          >
            Ir al panel de administración →
          </button>
          <Link to="/pricing" style={{ display:'block', fontSize:'0.82rem', color:'#9ca3af', textDecoration:'none' }}>← Ver otros planes</Link>
        </div>
      </div>
    );
  }

  /* ─── MAIN ─── */
  return (
    <div style={{ minHeight:'100vh', background: Cr, fontFamily:"'Outfit',sans-serif", display:'flex', flexDirection:'column' }}>
      {/* Nav */}
      <nav style={{ background: G, padding:'13px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Link to="/pricing" style={{ color:'#CFC1A5', textDecoration:'none', fontSize:'0.83rem', display:'flex', alignItems:'center', gap:5 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Cambiar plan
        </Link>
        <span style={{ color:'#F5F2EB', fontWeight:700, letterSpacing:2, fontSize:'0.95rem' }}>DRESSED</span>
        <div style={{ width:80 }}/>
      </nav>

      <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,0.9fr) minmax(0,1.4fr)', gap:24, maxWidth:860, width:'100%' }}>

          {/* ─ LEFT: plan summary ─ */}
          <div style={{ background:`linear-gradient(155deg,${G} 0%,#0d1f1d 100%)`, borderRadius:20, padding:'32px 28px', color:'#fff', display:'flex', flexDirection:'column' }}>
            <span style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.12em', color: Au, fontWeight:700 }}>Plan seleccionado</span>
            <h2 style={{ margin:'6px 0 20px', fontSize:'1.65rem', fontWeight:800 }}>{plan.name}</h2>
            <div style={{ marginBottom:28 }}>
              {isFree ? <span style={{ fontSize:'2.5rem', fontWeight:900 }}>Gratis</span> : (
                <div style={{ display:'flex', alignItems:'baseline', gap:3 }}>
                  <span style={{ fontSize:'0.95rem', opacity:0.5, alignSelf:'flex-start', marginTop:8 }}>$</span>
                  <span style={{ fontSize:'2.8rem', fontWeight:900, lineHeight:1 }}>{planPrice}</span>
                  <span style={{ opacity:0.5, fontSize:'0.85rem' }}>{cycle === 'YEARLY' ? '/año' : '/mes'}</span>
                </div>
              )}
            </div>
            <ul style={{ listStyle:'none', padding:0, margin:0, flex:1, display:'flex', flexDirection:'column', gap:11 }}>
              {[
                `${plan.maxBranches === 99 ? 'Ilimitadas' : plan.maxBranches} sucursal${plan.maxBranches !== 1 ? 'es' : ''}`,
                plan.aiGenerativeReports ? 'Reportes IA generativa' : 'Reportes básicos',
                'Operaciones offline', 'Punto de venta (POS)', 'Gestión inventario multisucursal',
              ].map(f => (
                <li key={f} style={{ display:'flex', alignItems:'center', gap:9, fontSize:'0.84rem', color:'rgba(255,255,255,0.78)' }}>
                  <Chk c={Au}/>{f}
                </li>
              ))}
            </ul>
            <div style={{ marginTop:28, padding:'12px 14px', background:'rgba(255,255,255,0.05)', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ margin:0, fontSize:'0.75rem', color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>Sin permanencia mínima. Cancela cuando quieras.</p>
            </div>
          </div>

          {/* ─ RIGHT: form / payment ─ */}
          <div style={{ background:'#fff', borderRadius:20, boxShadow:'0 4px 32px rgba(0,0,0,0.09)', padding:'32px 28px' }}>

            {/* STEP form */}
            {step === 'form' && (
              <>
                <h2 style={{ margin:'0 0 4px', fontSize:'1.25rem', fontWeight:800, color: G }}>Crea tu cuenta de empresa</h2>
                <p style={{ margin:'0 0 24px', fontSize:'0.82rem', color:'#6b7280' }}>
                  {isFree ? 'Regístrate gratis, sin tarjeta de crédito.' : 'Completa los datos antes de continuar al pago.'}
                </p>

                <form onSubmit={handleForm}>
                  <div style={{ borderBottom:'1px solid #f0ede8', paddingBottom:16, marginBottom:16 }}>
                    <p style={{ margin:'0 0 12px', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.09em', color:'#9ca3af', fontWeight:600 }}>Datos de la empresa</p>
                    <Field label="Nombre de la empresa *" value={bizName} onChange={setBizName} placeholder="Ej: Moda Elegante S.R.L."/>
                    <Field label="Identificador único (slug) *" value={slug} onChange={v => setSlug(slugify(v))} placeholder="mi-empresa" prefix="dressed.app/" hint="Solo minúsculas, números y guiones."/>
                    <Field label="NIT / Número tributario (opcional)" value={taxId} onChange={setTaxId} placeholder="Número de registro"/>
                  </div>

                  <p style={{ margin:'0 0 12px', fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.09em', color:'#9ca3af', fontWeight:600 }}>Cuenta del administrador</p>
                  <Field label="Nombre completo *" value={adminName} onChange={setAdminName} placeholder="Ej: María González"/>
                  <Field label="Correo electrónico *" value={adminEmail} onChange={setAdminEmail} type="email" placeholder="admin@miempresa.com"/>
                  <Field label="Contraseña *" value={adminPass} onChange={setAdminPass} type="password" placeholder="Mínimo 6 caracteres"/>
                  <Field label="Confirmar contraseña *" value={adminPass2} onChange={setAdminPass2} type="password" placeholder="Repite la contraseña"/>

                  {err && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:9, padding:'9px 13px', marginBottom:14 }}><p style={{ margin:0, fontSize:'0.8rem', color:'#dc2626' }}>{err}</p></div>}

                  <button type="submit" disabled={busy}
                    style={{ width:'100%', padding:'13px 0', border:'none', borderRadius:11, cursor:'pointer', background: Au, color:'#fff', fontWeight:700, fontSize:'0.9rem', opacity: busy ? 0.6 : 1, marginTop:4, letterSpacing:'0.02em' }}
                  >
                    {isFree ? (busy ? 'Creando…' : 'Crear empresa gratis →') : 'Continuar al pago →'}
                  </button>
                </form>
              </>
            )}

            {/* STEP verify */}
            {step === 'verify' && (
              <>
                <h2 style={{ margin:'0 0 4px', fontSize:'1.25rem', fontWeight:800, color: G }}>Verifica tu correo</h2>
                <p style={{ margin:'0 0 22px', fontSize:'0.84rem', color:'#6b7280', lineHeight:1.5 }}>
                  {emailSent
                    ? <>Enviamos un código de 6 dígitos a <b style={{ color: G }}>{adminEmail}</b>. Es válido por 15 minutos.</>
                    : <>No pudimos enviar el correo a <b style={{ color: G }}>{adminEmail}</b> (el servidor de correo no está configurado).</>}
                </p>

                {devCode && (
                  <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:9, padding:'9px 13px', marginBottom:16 }}>
                    <p style={{ margin:0, fontSize:'0.78rem', color:'#92400e' }}>
                      Modo desarrollo: tu código es <b style={{ fontFamily:'monospace', fontSize:'0.95rem', letterSpacing:3 }}>{devCode}</b>
                    </p>
                  </div>
                )}

                <form onSubmit={handleVerify}>
                  <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#374151', marginBottom:6 }}>Código de verificación</label>
                  <input
                    value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                    inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" autoFocus
                    style={{ width:'100%', boxSizing:'border-box', padding:'14px', border:'1.5px solid #d1d5db', borderRadius:10, fontSize:'1.6rem', fontFamily:'monospace', letterSpacing:'0.5em', textAlign:'center', outline:'none', marginBottom:14 }}
                  />

                  {info && <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9, padding:'9px 13px', marginBottom:14 }}><p style={{ margin:0, fontSize:'0.8rem', color:'#15803d' }}>{info}</p></div>}
                  {err && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:9, padding:'9px 13px', marginBottom:14 }}><p style={{ margin:0, fontSize:'0.8rem', color:'#dc2626' }}>{err}</p></div>}

                  <button type="submit" disabled={busy || code.length !== 6}
                    style={{ width:'100%', padding:'13px 0', border:'none', borderRadius:11, cursor: code.length === 6 ? 'pointer' : 'not-allowed', background: G, color:'#fff', fontWeight:700, fontSize:'0.9rem', opacity: busy || code.length !== 6 ? 0.55 : 1 }}>
                    {busy ? 'Verificando…' : 'Verificar y activar cuenta'}
                  </button>
                  <button type="button" onClick={handleResend} disabled={cooldown > 0}
                    style={{ width:'100%', background:'none', border:'none', cursor: cooldown > 0 ? 'default' : 'pointer', color: cooldown > 0 ? '#9ca3af' : Au, fontWeight:600, fontSize:'0.82rem', padding:'12px 0 0' }}>
                    {cooldown > 0 ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}
                  </button>
                </form>
              </>
            )}

            {/* STEP payment */}
            {step === 'payment' && (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <h2 style={{ margin:0, fontSize:'1.25rem', fontWeight:800, color: G }}>Datos de pago</h2>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:'#9ca3af' }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Pago seguro · Stripe
                  </div>
                </div>

                {/* Card preview */}
                <div style={{ background:'linear-gradient(135deg,#1e293b,#0f172a)', borderRadius:14, padding:22, marginBottom:20, color:'#fff', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:-25, right:-25, width:100, height:100, background:'rgba(255,255,255,0.04)', borderRadius:'50%' }}/>
                  <div style={{ position:'absolute', bottom:-35, left:-15, width:90, height:90, background:'rgba(255,255,255,0.04)', borderRadius:'50%' }}/>
                  <div style={{ position:'relative' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                      <div style={{ width:40, height:26, background:'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius:5 }}/>
                      <div style={{ display:'flex' }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:'#ef4444', opacity:0.9 }}/>
                        <div style={{ width:26, height:26, borderRadius:'50%', background:'#f59e0b', opacity:0.9, marginLeft:-10 }}/>
                      </div>
                    </div>
                    <p style={{ margin:'0 0 14px', fontFamily:'monospace', fontSize:'1rem', letterSpacing:'0.14em' }}>{cardNum || '•••• •••• •••• ••••'}</p>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <div><p style={{ margin:0, fontSize:'0.6rem', opacity:0.4, textTransform:'uppercase' }}>Titular</p><p style={{ margin:'2px 0 0', fontSize:'0.82rem', fontWeight:500 }}>{cardHolder || 'NOMBRE APELLIDO'}</p></div>
                      <div style={{ textAlign:'right' }}><p style={{ margin:0, fontSize:'0.6rem', opacity:0.4, textTransform:'uppercase' }}>Vence</p><p style={{ margin:'2px 0 0', fontSize:'0.82rem', fontFamily:'monospace' }}>{expiry || 'MM/AA'}</p></div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePayment}>
                  <Field label="Número de tarjeta" value={cardNum} onChange={v => setCardNum(fmtCard(v))} placeholder="1234 5678 9012 3456" type="tel" maxLen={19}/>
                  <Field label="Nombre del titular" value={cardHolder} onChange={v => setCardHolder(v.toUpperCase())} placeholder="NOMBRE APELLIDO"/>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <Field label="Vencimiento" value={expiry} onChange={v => setExpiry(fmtExpiry(v))} placeholder="MM/AA" type="tel" maxLen={5}/>
                    <Field label="CVC" value={cvc} onChange={v => setCvc(v.replace(/\D/g,'').slice(0,3))} placeholder="123" type="tel" maxLen={3}/>
                  </div>

                  <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:9, padding:'9px 13px', marginBottom:14, display:'flex', gap:8 }}>
                    <svg width="13" height="13" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink:0, marginTop:1 }}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <p style={{ margin:0, fontSize:'0.75rem', color:'#1d4ed8', lineHeight:1.5 }}>Tarjeta de prueba: <strong>4242 4242 4242 4242</strong>, cualquier fecha futura y cualquier CVC.</p>
                  </div>

                  {err && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:9, padding:'9px 13px', marginBottom:14 }}><p style={{ margin:0, fontSize:'0.8rem', color:'#dc2626' }}>{err}</p></div>}

                  <button type="submit" disabled={busy}
                    style={{ width:'100%', padding:'13px 0', border:'none', borderRadius:11, cursor:'pointer', background: busy ? '#d1d5db' : G, color:'#fff', fontWeight:700, fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:9 }}
                  >
                    {busy ? (
                      <><svg width="17" height="17" fill="none" viewBox="0 0 24 24" style={{ animation:'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4"/><path fill="rgba(255,255,255,0.9)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Procesando pago…</>
                    ) : `Pagar $${planPrice}${cycle === 'YEARLY' ? '/año' : '/mes'} y activar empresa`}
                  </button>
                  <button type="button" onClick={() => { setStep('form'); setErr(''); }}
                    style={{ width:'100%', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'0.8rem', padding:'10px 0', marginTop:4 }}>
                    ← Volver a datos de empresa
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
