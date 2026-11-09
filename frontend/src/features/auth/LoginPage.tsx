import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from './AuthContext';

/* Icono SVG de la plataforma (ropa/percha) */
const AppIcon = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="52" height="52" rx="14" fill="rgba(201,144,74,0.18)"/>
    <path d="M26 10 C22 10 19 13 19 16 L10 21 L14 25 L19 22 L19 42 L33 42 L33 22 L38 25 L42 21 L33 16 C33 13 30 10 26 10Z" fill="#C9904A" opacity="0.9"/>
    <circle cx="26" cy="15" r="3" fill="#C9904A"/>
  </svg>
);

/* Badge de empresa detectada */
const TenantBadge = ({ name }: { name: string }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'rgba(201,144,74,0.15)', border: '1px solid rgba(201,144,74,0.4)',
    borderRadius: 20, padding: '5px 14px', marginTop: 16,
  }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}/>
    <span style={{ fontSize: '0.8rem', color: '#C9904A', fontWeight: 600 }}>{name}</span>
  </div>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const tenantSlug = searchParams.get('tenant') ?? '';
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);

  /* Si viene ?tenant=slug, buscar el nombre de la empresa */
  useEffect(() => {
    if (!tenantSlug) return;
    setTenantLoading(true);
    api.get(`/saas/tenants/by-slug/${tenantSlug}`)
      .then(r => setTenantName(r.data.name))
      .catch(() => setTenantName(null))
      .finally(() => setTenantLoading(false));
  }, [tenantSlug]);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setError(null);
    try {
      const { data } = await api.post('/auth/login', formData);
      login(data.accessToken, data.user);
      if (data.user.mustChangePassword) { navigate('/change-password', { replace: true }); return; }
      if (['ADMIN','ENCARGADO','CAJERO'].some(r => data.user.roles.includes(r))) {
        navigate('/dashboard', { replace: true });
      } else {
        const pr = sessionStorage.getItem('pendingReservation');
        if (pr) { try { navigate('/reservations/new', { state: JSON.parse(pr), replace: true }); return; } catch {} }
        const redir = sessionStorage.getItem('redirectUrl');
        if (redir) { sessionStorage.removeItem('redirectUrl'); navigate(redir, { replace: true }); return; }
        navigate('/account', { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.status === 401
        ? (err.response?.data?.message || 'Correo o contraseña incorrectos')
        : 'Error al intentar iniciar sesión');
    } finally { setIsSubmitting(false); }
  };

  /* ── Estilos inline ── */
  const G = '#182D2A';
  const Au = '#C9904A';
  const Cr = '#F5F2EB';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'Outfit', system-ui, sans-serif", background: Cr }}>

      {/* ── PANEL IZQUIERDO: marca de la plataforma ── */}
      <div style={{
        width: '44%', minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '48px 40px',
        background: `linear-gradient(155deg, ${G} 0%, #0d1f1d 100%)`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Círculos decorativos */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(201,144,74,0.07)' }}/>
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 180, height: 180, borderRadius: '50%', background: 'rgba(201,144,74,0.05)' }}/>

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 320 }}>
          <AppIcon />

          {/* Nombre de la plataforma SaaS */}
          <div style={{ marginTop: 20 }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: Au, display: 'block', marginBottom: 6,
            }}>Plataforma de gestión</span>
            <h1 style={{ margin: 0, fontSize: '1.95rem', fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>
              FashionOS
            </h1>
            <p style={{ margin: '10px 0 0', fontSize: '0.88rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
              Sistema SaaS para tiendas de moda.<br/>Inventario · POS · Reportes · IA.
            </p>
          </div>

          {/* Badge de empresa si viene el parámetro ?tenant= */}
          {tenantSlug && (
            <div style={{ marginTop: 28 }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Accediendo a
              </p>
              {tenantLoading
                ? <div style={{ width: 100, height: 28, background: 'rgba(255,255,255,0.08)', borderRadius: 20, margin: '8px auto' }}/>
                : tenantName
                  ? <TenantBadge name={tenantName}/>
                  : <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>Empresa no encontrada</span>
              }
            </div>
          )}

          {/* Separador + stats */}
          <div style={{ display: 'flex', gap: 20, marginTop: 44, justifyContent: 'center' }}>
            {[['4 planes', 'desde gratis'], ['Multisucursal', 'ilimitado'], ['IA incluida', 'plan Pro+']].map(([v, l]) => (
              <div key={v} style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: Au }}>{v}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer del panel */}
        <p style={{ position: 'absolute', bottom: 20, fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center' }}>
          FashionOS © {new Date().getFullYear()} · Plataforma multitenant
        </p>
      </div>

      {/* ── PANEL DERECHO: formulario ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Header del form */}
          <div style={{ marginBottom: 32 }}>
            {tenantName
              ? <>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: Au, fontWeight: 700 }}>{tenantName}</span>
                  <h2 style={{ margin: '6px 0 4px', fontSize: '1.6rem', fontWeight: 800, color: G }}>Iniciar sesión</h2>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#6b7280' }}>Ingresa tus credenciales de empresa</p>
                </>
              : <>
                  <h2 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: 800, color: G }}>Bienvenido</h2>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#6b7280' }}>Ingresa tus credenciales para continuar</p>
                </>
            }
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
              <p style={{ margin: 0, fontSize: '0.83rem', color: '#dc2626' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Correo electrónico
              </label>
              <input
                type="email" name="email" value={formData.email} onChange={handleChange}
                placeholder="admin@empresa.com" required
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}
                onFocus={e => e.target.style.borderColor = Au}
                onBlur={e => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                  placeholder="••••••••" required
                  style={{ width: '100%', padding: '11px 42px 11px 14px', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}
                  onFocus={e => e.target.style.borderColor = Au}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
                  {showPass
                    ? <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', color: '#6b7280', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: G }}/> Recordarme
              </label>
              <a href="#" style={{ fontSize: '0.82rem', color: Au, textDecoration: 'none', fontWeight: 500 }}>¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" disabled={isSubmitting}
              style={{ width: '100%', padding: '13px 0', background: isSubmitting ? '#6b7280' : G, color: '#fff', border: 'none', borderRadius: 11, fontSize: '0.92rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', letterSpacing: '0.02em', transition: 'background 0.15s' }}
            >
              {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Links inferiores */}
          <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#6b7280' }}>
              ¿No tienes una cuenta?{' '}
              <Link to="/pricing" style={{ color: Au, fontWeight: 600, textDecoration: 'none' }}>Registra tu empresa</Link>
            </p>
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#6b7280' }}>
              ¿Ya compraste en nuestra tienda?{' '}
              <Link to="/activate-account" style={{ color: G, fontWeight: 600, textDecoration: 'none' }}>Activa tu cuenta</Link>
            </p>
          </div>

          {/* Acceso rápido por slug de empresa */}
          <div style={{ marginTop: 32, padding: '16px 18px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Acceder por empresa</p>
            <TenantSlugInput />
          </div>
        </div>
      </div>
    </div>
  );
};

/* Mini componente: input de slug para ir al login de empresa específica */
const TenantSlugInput = () => {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
        placeholder="slug-de-empresa"
        style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.82rem', outline: 'none', fontFamily: 'monospace' }}
        onKeyDown={e => { if (e.key === 'Enter' && slug) navigate(`/login?tenant=${slug}`); }}
      />
      <button
        onClick={() => { if (slug) navigate(`/login?tenant=${slug}`); }}
        disabled={!slug}
        style={{ padding: '8px 14px', background: '#182D2A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: slug ? 'pointer' : 'not-allowed', opacity: slug ? 1 : 0.4 }}
      >
        Ir →
      </button>
    </div>
  );
};
