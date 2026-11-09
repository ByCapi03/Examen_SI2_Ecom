import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from './AuthContext';

/* ── Icono de plataforma ── */
const AppIcon = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
    <rect width="52" height="52" rx="13" fill="rgba(201,144,74,0.18)"/>
    <path d="M26 10C22 10 19 13 19 16L10 21l4 4 5-3v20h14V22l5 3 4-4-9-5c0-3-3-6-7-6z" fill="#C9904A"/>
    <circle cx="26" cy="15" r="3" fill="#C9904A"/>
  </svg>
);

/* ── Badge empresa detectada ── */
const TenantBadge = ({ name }: { name: string }) => (
  <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'rgba(201,144,74,0.14)', border:'1px solid rgba(201,144,74,0.4)', borderRadius:20, padding:'5px 14px' }}>
    <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>
    <span style={{ fontSize:'0.82rem', color:'#C9904A', fontWeight:600 }}>{name}</span>
  </div>
);

/* ── Input de slug para acceder por empresa ── */
const TenantSlugInput = () => {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  return (
    <div style={{ display:'flex', gap:8 }}>
      <input
        value={slug}
        onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
        placeholder="slug-de-empresa"
        style={{ flex:1, padding:'9px 12px', border:'1.5px solid #d1d5db', borderRadius:9, fontSize:'0.82rem', outline:'none', fontFamily:'monospace', background:'#fff', minWidth:0 }}
        onKeyDown={e => { if (e.key==='Enter' && slug) navigate(`/login?tenant=${slug}`); }}
      />
      <button
        onClick={() => { if (slug) navigate(`/login?tenant=${slug}`); }}
        disabled={!slug}
        style={{ padding:'9px 16px', background:'#182D2A', color:'#fff', border:'none', borderRadius:9, fontSize:'0.82rem', fontWeight:700, cursor:slug?'pointer':'not-allowed', opacity:slug?1:0.4, whiteSpace:'nowrap', flexShrink:0 }}
      >
        Ir →
      </button>
    </div>
  );
};

/* ── Componente de campo de formulario ── */
const Field = ({ label, name, type='text', value, onChange, placeholder, action }: {
  label: string; name: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  action?: React.ReactNode;
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#374151', marginBottom:6 }}>{label}</label>
      <div style={{ position:'relative' }}>
        <input
          type={type} name={name} value={value} required
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width:'100%', boxSizing:'border-box',
            padding: action ? '11px 44px 11px 14px' : '11px 14px',
            border:`1.5px solid ${focused ? '#C9904A' : '#d1d5db'}`,
            borderRadius:10, fontSize:'0.9rem', outline:'none',
            fontFamily:'inherit', background:'#fff',
            boxShadow: focused ? '0 0 0 3px rgba(201,144,74,0.12)' : 'none',
            transition:'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {action && (
          <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════
   PÁGINA PRINCIPAL
════════════════════════════════════ */
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.accessToken, data.user);
      if (data.user.mustChangePassword) { navigate('/change-password', { replace:true }); return; }
      if (['ADMIN','ENCARGADO','CAJERO'].some(r => data.user.roles.includes(r))) {
        navigate('/dashboard', { replace:true });
      } else {
        const pr = sessionStorage.getItem('pendingReservation');
        if (pr) { try { navigate('/reservations/new', { state:JSON.parse(pr), replace:true }); return; } catch {} }
        const redir = sessionStorage.getItem('redirectUrl');
        if (redir) { sessionStorage.removeItem('redirectUrl'); navigate(redir, { replace:true }); return; }
        navigate('/account', { replace:true });
      }
    } catch (err: any) {
      setError(err.response?.status===401
        ? (err.response?.data?.message || 'Correo o contraseña incorrectos')
        : 'Error al intentar iniciar sesión');
    } finally { setIsSubmitting(false); }
  };

  const EyeIcon = ({ open }: { open: boolean }) => open
    ? <svg width="18" height="18" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
    : <svg width="18" height="18" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;

  return (
    <>
      {/* ── CSS responsive ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }

        .login-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: row;
          font-family: 'Outfit', system-ui, sans-serif;
          background: #F5F2EB;
        }

        /* ── Panel izquierdo (sidebar) ── */
        .login-sidebar {
          width: 420px;
          min-width: 300px;
          flex-shrink: 0;
          background: linear-gradient(155deg, #182D2A 0%, #0d1f1d 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 36px;
          position: relative;
          overflow: hidden;
        }
        .login-sidebar::before {
          content:'';
          position:absolute; top:-90px; right:-90px;
          width:260px; height:260px; border-radius:50%;
          background: rgba(201,144,74,0.07);
        }
        .login-sidebar::after {
          content:'';
          position:absolute; bottom:-60px; left:-60px;
          width:200px; height:200px; border-radius:50%;
          background: rgba(201,144,74,0.05);
        }
        .sidebar-content { position:relative; text-align:center; max-width:280px; }

        /* ── Panel derecho (formulario) ── */
        .login-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
          min-width: 0;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
        }

        /* ── MOBILE: < 768px ── */
        @media (max-width: 767px) {
          .login-wrap { flex-direction: column; }

          .login-sidebar {
            width: 100%;
            min-width: unset;
            padding: 28px 20px 24px;
            flex-direction: row;
            justify-content: flex-start;
            gap: 16px;
            border-radius: 0 0 24px 24px;
          }
          .login-sidebar::before { top:-60px; right:-60px; width:160px; height:160px; }
          .login-sidebar::after { display:none; }

          .sidebar-content {
            text-align: left;
            max-width: unset;
            display: flex;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
          }
          .sidebar-platform-name { font-size: 1.3rem !important; }
          .sidebar-tagline { display: none; }
          .sidebar-stats { display: none; }
          .sidebar-tenant-block { margin-top: 0 !important; }
          .sidebar-footer { display: none; }

          .login-main { padding: 28px 16px 40px; align-items: flex-start; }
          .login-card { max-width: 100%; }
        }

        /* ── TABLET: 768–1023px ── */
        @media (min-width: 768px) and (max-width: 1023px) {
          .login-sidebar { width: 320px; padding: 40px 28px; }
        }
      `}</style>

      <div className="login-wrap">

        {/* ════════ SIDEBAR ════════ */}
        <aside className="login-sidebar">
          <div className="sidebar-content">
            <AppIcon size={48}/>

            <div>
              <span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:'#C9904A', display:'block', marginBottom:4 }}>
                Plataforma de gestión
              </span>
              <h1 className="sidebar-platform-name" style={{ margin:0, fontSize:'1.75rem', fontWeight:900, color:'#fff', letterSpacing:'0.03em', lineHeight:1 }}>
                FashionOS
              </h1>
              <p className="sidebar-tagline" style={{ margin:'10px 0 0', fontSize:'0.84rem', color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>
                Sistema SaaS para tiendas de moda.<br/>Inventario · POS · Reportes · IA.
              </p>

              {/* Badge de empresa */}
              {tenantSlug && (
                <div className="sidebar-tenant-block" style={{ marginTop:20 }}>
                  <p style={{ margin:'0 0 6px', fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
                    Accediendo a
                  </p>
                  {tenantLoading
                    ? <div style={{ width:120, height:28, background:'rgba(255,255,255,0.08)', borderRadius:20 }}/>
                    : tenantName
                      ? <TenantBadge name={tenantName}/>
                      : tenantSlug && <span style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.3)' }}>Empresa no encontrada</span>
                  }
                </div>
              )}
            </div>

            {/* Stats — solo desktop */}
            <div className="sidebar-stats" style={{ display:'flex', gap:22, marginTop:40 }}>
              {[['4 planes','desde gratis'],['Multisucursal','ilimitado'],['IA incluida','plan Pro+']].map(([v,l]) => (
                <div key={v} style={{ textAlign:'center' }}>
                  <p style={{ margin:0, fontWeight:800, fontSize:'0.85rem', color:'#C9904A' }}>{v}</p>
                  <p style={{ margin:'2px 0 0', fontSize:'0.65rem', color:'rgba(255,255,255,0.28)' }}>{l}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="sidebar-footer" style={{ position:'absolute', bottom:16, fontSize:'0.65rem', color:'rgba(255,255,255,0.18)', textAlign:'center' }}>
            FashionOS © {new Date().getFullYear()} · Plataforma multitenant
          </p>
        </aside>

        {/* ════════ FORMULARIO ════════ */}
        <main className="login-main">
          <div className="login-card">

            {/* Header */}
            <div style={{ marginBottom:28 }}>
              {tenantName
                ? <>
                    <span style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'#C9904A', fontWeight:700 }}>{tenantName}</span>
                    <h2 style={{ margin:'5px 0 4px', fontSize:'1.55rem', fontWeight:800, color:'#182D2A' }}>Iniciar sesión</h2>
                    <p style={{ margin:0, fontSize:'0.83rem', color:'#6b7280' }}>Ingresa tus credenciales de empresa</p>
                  </>
                : <>
                    <h2 style={{ margin:'0 0 5px', fontSize:'1.55rem', fontWeight:800, color:'#182D2A' }}>Bienvenido</h2>
                    <p style={{ margin:0, fontSize:'0.83rem', color:'#6b7280' }}>Ingresa tus credenciales para continuar</p>
                  </>
              }
            </div>

            {/* Error */}
            {error && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', marginBottom:18 }}>
                <p style={{ margin:0, fontSize:'0.83rem', color:'#dc2626' }}>{error}</p>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              <Field label="Correo electrónico" name="email" type="email" value={email} onChange={setEmail} placeholder="admin@empresa.com"/>

              <Field
                label="Contraseña" name="password"
                type={showPass ? 'text' : 'password'}
                value={password} onChange={setPassword} placeholder="••••••••"
                action={
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
                    <EyeIcon open={showPass}/>
                  </button>
                }
              />

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:8 }}>
                <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:'0.82rem', color:'#6b7280', cursor:'pointer' }}>
                  <input type="checkbox" style={{ accentColor:'#182D2A', width:15, height:15 }}/> Recordarme
                </label>
                <a href="#" style={{ fontSize:'0.82rem', color:'#C9904A', textDecoration:'none', fontWeight:500 }}>
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <button type="submit" disabled={isSubmitting} style={{
                width:'100%', padding:'13px 0',
                background: isSubmitting ? '#6b7280' : '#182D2A',
                color:'#fff', border:'none', borderRadius:11,
                fontSize:'0.95rem', fontWeight:700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                letterSpacing:'0.02em', transition:'background 0.15s',
              }}>
                {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
              </button>
            </form>

            {/* Links */}
            <div style={{ marginTop:22, display:'flex', flexDirection:'column', gap:9, textAlign:'center' }}>
              <p style={{ margin:0, fontSize:'0.83rem', color:'#6b7280' }}>
                ¿No tienes una cuenta?{' '}
                <Link to="/pricing" style={{ color:'#C9904A', fontWeight:600, textDecoration:'none' }}>Registra tu empresa</Link>
              </p>
              <p style={{ margin:0, fontSize:'0.83rem', color:'#6b7280' }}>
                ¿Ya compraste en nuestra tienda?{' '}
                <Link to="/activate-account" style={{ color:'#182D2A', fontWeight:600, textDecoration:'none' }}>Activa tu cuenta</Link>
              </p>
            </div>

            {/* Acceso por slug */}
            <div style={{ marginTop:28, padding:'14px 16px', background:'#f9fafb', borderRadius:12, border:'1px solid #e5e7eb' }}>
              <p style={{ margin:'0 0 9px', fontSize:'0.72rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.09em' }}>
                Acceder por empresa
              </p>
              <TenantSlugInput/>
            </div>
          </div>
        </main>
      </div>
    </>
  );

  /* Componente de icono ojo */
  function EyeIcon({ open }: { open: boolean }) {
    return open
      ? <svg width="18" height="18" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
      : <svg width="18" height="18" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
  }
};
