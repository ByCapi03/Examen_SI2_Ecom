import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from './AuthContext';

const TenantBadge = ({ name }: { name: string }) => (
  <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(201,144,74,0.14)', border:'1px solid rgba(201,144,74,0.4)', borderRadius:20, padding:'4px 12px', marginTop:10 }}>
    <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>
    <span style={{ fontSize:'0.78rem', color:'#C9904A', fontWeight:600 }}>{name}</span>
  </div>
);

const EyeIcon = ({ open }: { open: boolean }) => open
  ? <svg width="17" height="17" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
  : <svg width="17" height="17" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const tenantSlug = searchParams.get('tenant') ?? '';
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    setTenantLoading(true);
    api.get(`/saas/tenants/by-slug/${tenantSlug}`)
      .then(r => setTenantName(r.data.name))
      .catch(() => setTenantName(null))
      .finally(() => setTenantLoading(false));
  }, [tenantSlug]);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);
  const [code, setCode] = useState('');
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null);

  // El cajero no tiene dashboard: entra directo a su caja.
  const staffHome = (roles: string[]) => (roles.includes('ADMIN') || roles.includes('ENCARGADO') ? '/dashboard' : '/dashboard/pos');

  const goAfterLogin = (user: any) => {
    if (['ADMIN','ENCARGADO','CAJERO'].some(r => user.roles.includes(r))) navigate(staffHome(user.roles), { replace:true });
    else navigate('/account', { replace:true });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null); setVerifyInfo(null);
    try {
      const { data } = await api.post('/saas/tenants/verify-email', { email, code });
      login(data.accessToken, data.user);
      goAfterLogin(data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo verificar el código');
    } finally { setIsSubmitting(false); }
  };

  const handleResend = async () => {
    setError(null); setVerifyInfo(null);
    try {
      const { data } = await api.post('/saas/tenants/resend-code', { email });
      setVerifyInfo(data.devCode ? `Modo desarrollo: tu código es ${data.devCode}` : 'Si existe una verificación pendiente, enviamos un nuevo código a tu correo.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo reenviar el código');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.accessToken, data.user);
      if (data.user.mustChangePassword) { navigate('/change-password', { replace:true }); return; }
      if (['ADMIN','ENCARGADO','CAJERO'].some(r => data.user.roles.includes(r))) {
        navigate(staffHome(data.user.roles), { replace:true });
      } else {
        const pr = sessionStorage.getItem('pendingReservation');
        if (pr) {
          try {
            const me = await api.get('/saas/tenants/me', { headers: { Authorization: `Bearer ${data.accessToken}` } });
            navigate(`/t/${me.data.slug}/reservations/new`, { state:JSON.parse(pr), replace:true }); return;
          } catch {}
        }
        const redir = sessionStorage.getItem('redirectUrl');
        if (redir) { sessionStorage.removeItem('redirectUrl'); navigate(redir, { replace:true }); return; }
        navigate('/account', { replace:true });
      }
    } catch (err: any) {
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerify(true);
        setError(null);
        return;
      }
      setError(err.response?.status === 401
        ? (err.response?.data?.message || 'Correo o contraseña incorrectos')
        : 'Error al intentar iniciar sesión');
    } finally { setIsSubmitting(false); }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    padding: field === 'password' ? '11px 44px 11px 14px' : '11px 14px',
    border: `1.5px solid ${focusedField === field ? '#C9904A' : '#d1d5db'}`,
    borderRadius: 10, fontSize: '0.9rem', outline: 'none',
    fontFamily: 'inherit', background: '#fff',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(201,144,74,0.12)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  });

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }

        /* página: fondo crema, centrado vertical */
        .lp-page {
          min-height: 100vh;
          background: #F5F2EB;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          font-family: 'Outfit', system-ui, sans-serif;
        }

        /* tarjeta contenedora */
        .lp-card {
          display: flex;
          width: 100%;
          max-width: 820px;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 12px 56px rgba(0,0,0,0.13);
        }

        /* panel izquierdo verde (card, no full-height) */
        .lp-brand {
          width: 300px;
          flex-shrink: 0;
          background: linear-gradient(155deg, #182D2A 0%, #0d1f1d 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
          position: relative;
          overflow: hidden;
          text-align: center;
        }
        .lp-brand::before {
          content: '';
          position: absolute; top: -60px; right: -60px;
          width: 180px; height: 180px; border-radius: 50%;
          background: rgba(201,144,74,0.08);
        }
        .lp-brand::after {
          content: '';
          position: absolute; bottom: -50px; left: -50px;
          width: 150px; height: 150px; border-radius: 50%;
          background: rgba(201,144,74,0.05);
        }
        .lp-brand-inner { position: relative; }

        /* panel derecho: formulario */
        .lp-form-panel {
          flex: 1;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 44px 36px;
          min-width: 0;
        }
        .lp-form-inner { width: 100%; max-width: 340px; }

        /* ── Móvil < 640px ── */
        @media (max-width: 639px) {
          .lp-page { padding: 0; align-items: stretch; }

          .lp-card {
            flex-direction: column;
            border-radius: 0;
            box-shadow: none;
            min-height: 100vh;
          }

          .lp-brand {
            width: 100%;
            padding: 28px 24px;
            flex-direction: row;
            justify-content: flex-start;
            gap: 16px;
            text-align: left;
            border-radius: 0;
          }
          .lp-brand::before { width: 110px; height: 110px; top:-40px; right:-40px; }
          .lp-brand::after  { display: none; }
          .lp-brand-tagline { display: none; }
          .lp-brand-tenant  { display: none; }

          .lp-form-panel { padding: 28px 20px 36px; align-items: flex-start; }
          .lp-form-inner { max-width: 100%; }
        }

        /* ── Tablet 640–900px ── */
        @media (min-width: 640px) and (max-width: 900px) {
          .lp-brand { width: 240px; padding: 40px 24px; }
          .lp-form-panel { padding: 36px 28px; }
        }
      `}</style>

      <div className="lp-page">
        <div className="lp-card">

          {/* ── PANEL VERDE ── */}
          <div className="lp-brand">
            <div className="lp-brand-inner">
              <h1 style={{ margin:0, fontSize:'2.2rem', fontWeight:900, color:'#fff', letterSpacing:'0.1em', lineHeight:1 }}>
                DRESSED
              </h1>
              <p className="lp-brand-tagline" style={{ margin:'14px 0 0', fontSize:'0.8rem', color:'rgba(255,255,255,0.38)', lineHeight:1.75 }}>
                Gestiona tu tienda de moda.<br/>Inventario · POS · Reportes.
              </p>

              {/* Badge empresa solo si slug ya cargó */}
              {tenantSlug && !tenantLoading && (
                <div className="lp-brand-tenant" style={{ marginTop:20 }}>
                  <p style={{ margin:'0 0 6px', fontSize:'0.63rem', color:'rgba(255,255,255,0.28)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                    Accediendo a
                  </p>
                  {tenantName
                    ? <TenantBadge name={tenantName}/>
                    : <span style={{ fontSize:'0.73rem', color:'rgba(255,255,255,0.28)' }}>Empresa no encontrada</span>
                  }
                </div>
              )}
            </div>
          </div>

          {/* ── PANEL FORMULARIO ── */}
          <div className="lp-form-panel">
            <div className="lp-form-inner">

              {/* Header */}
              <div style={{ marginBottom:26 }}>
                {tenantName
                  ? <>
                      <span style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'#C9904A', fontWeight:700 }}>{tenantName}</span>
                      <h2 style={{ margin:'5px 0 4px', fontSize:'1.5rem', fontWeight:800, color:'#182D2A' }}>Iniciar sesión</h2>
                      <p style={{ margin:0, fontSize:'0.82rem', color:'#6b7280' }}>Ingresa tus credenciales de empresa</p>
                    </>
                  : <>
                      <h2 style={{ margin:'0 0 5px', fontSize:'1.5rem', fontWeight:800, color:'#182D2A' }}>Bienvenido</h2>
                      <p style={{ margin:0, fontSize:'0.82rem', color:'#6b7280' }}>Ingresa tus credenciales para continuar</p>
                    </>
                }
              </div>

              {/* Error */}
              {error && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
                  <p style={{ margin:0, fontSize:'0.82rem', color:'#dc2626' }}>{error}</p>
                </div>
              )}

              {needsVerify && (
                <form onSubmit={handleVerify} style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:14, marginBottom:18 }}>
                  <p style={{ margin:'0 0 10px', fontSize:'0.82rem', color:'#92400e', lineHeight:1.45 }}>
                    Tu correo aún no está verificado. Ingresa el código de 6 dígitos que enviamos a <b>{email}</b>.
                  </p>
                  <input
                    value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                    inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
                    style={{ width:'100%', boxSizing:'border-box', padding:'10px', border:'1.5px solid #fcd34d', borderRadius:9, fontSize:'1.2rem', fontFamily:'monospace', letterSpacing:'0.4em', textAlign:'center', outline:'none', marginBottom:10 }}
                  />
                  {verifyInfo && <p style={{ margin:'0 0 10px', fontSize:'0.78rem', color:'#15803d' }}>{verifyInfo}</p>}
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="submit" disabled={isSubmitting || code.length !== 6}
                      style={{ flex:1, padding:'10px 0', background:'#182D2A', color:'#fff', border:'none', borderRadius:9, fontWeight:700, fontSize:'0.84rem', cursor:'pointer', opacity: code.length === 6 ? 1 : 0.5 }}>
                      Verificar y entrar
                    </button>
                    <button type="button" onClick={handleResend}
                      style={{ padding:'10px 12px', background:'transparent', color:'#92400e', border:'1.5px solid #fcd34d', borderRadius:9, fontWeight:600, fontSize:'0.8rem', cursor:'pointer' }}>
                      Reenviar
                    </button>
                  </div>
                </form>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:'0.79rem', fontWeight:600, color:'#374151', marginBottom:6 }}>Correo electrónico</label>
                  <input
                    type="email" value={email} required
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@empresa.com"
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField('')}
                    style={inputStyle('email')}
                  />
                </div>

                <div style={{ marginBottom:18 }}>
                  <label style={{ display:'block', fontSize:'0.79rem', fontWeight:600, color:'#374151', marginBottom:6 }}>Contraseña</label>
                  <div style={{ position:'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'} value={password} required
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField('')}
                      style={inputStyle('password')}
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
                      <EyeIcon open={showPass}/>
                    </button>
                  </div>
                </div>

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:8 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:'0.81rem', color:'#6b7280', cursor:'pointer' }}>
                    <input type="checkbox" style={{ accentColor:'#182D2A', width:14, height:14 }}/> Recordarme
                  </label>
                  <a href="#" style={{ fontSize:'0.81rem', color:'#C9904A', textDecoration:'none', fontWeight:500 }}>
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>

                <button type="submit" disabled={isSubmitting} style={{
                  width:'100%', padding:'12px 0',
                  background: isSubmitting ? '#6b7280' : '#182D2A',
                  color:'#fff', border:'none', borderRadius:11,
                  fontSize:'0.93rem', fontWeight:700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition:'background 0.15s',
                }}>
                  {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
                </button>
              </form>

              {/* Links */}
              <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:8, textAlign:'center' }}>
                <p style={{ margin:0, fontSize:'0.81rem', color:'#6b7280' }}>
                  ¿No tienes una cuenta?{' '}
                  <Link to="/pricing" style={{ color:'#C9904A', fontWeight:600, textDecoration:'none' }}>Registra tu empresa</Link>
                </p>
                {tenantSlug && (
                  <p style={{ margin:0, fontSize:'0.81rem', color:'#6b7280' }}>
                    ¿Eres cliente de {tenantName ?? 'esta tienda'}?{' '}
                    <Link to={`/register?tenant=${tenantSlug}`} style={{ color:'#C9904A', fontWeight:600, textDecoration:'none' }}>Crear cuenta de cliente</Link>
                  </p>
                )}
                <p style={{ margin:0, fontSize:'0.81rem', color:'#6b7280' }}>
                  ¿Ya compraste en nuestra tienda?{' '}
                  <Link to="/activate-account" style={{ color:'#182D2A', fontWeight:600, textDecoration:'none' }}>Activa tu cuenta</Link>
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
};
