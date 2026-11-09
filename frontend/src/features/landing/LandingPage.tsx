import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Boxes, ShoppingCart, BarChart3, Globe, Smartphone, Building2, Shirt } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const FEATURES = [
  { icon: <ShoppingCart size={22} />, title: 'Punto de venta y cajas', text: 'Cajas por sucursal, sesiones de caja, ventas y arqueos controlados por cajero.' },
  { icon: <Boxes size={22} />, title: 'Inventario multisucursal', text: 'Existencias por sucursal y variante (talla/color), movimientos y alertas de stock.' },
  { icon: <Globe size={22} />, title: 'Tu catálogo en línea', text: 'Cada empresa recibe su propio enlace para compartir el catálogo con sus clientes.' },
  { icon: <Shirt size={22} />, title: 'Vestidor virtual', text: 'Tus clientes prueban las prendas antes de reservar o comprar.' },
  { icon: <BarChart3 size={22} />, title: 'Reportes y analítica', text: 'Panel con gráficas, reportes inteligentes y predicción de demanda.' },
  { icon: <Smartphone size={22} />, title: 'App móvil para clientes', text: 'Tus clientes inician sesión con su correo y ven el catálogo de tu empresa.' },
];

const STEPS = [
  { n: '1', title: 'Registra tu empresa', text: 'Crea tu cuenta de administrador y elige un plan. El plan Básico es gratis.' },
  { n: '2', title: 'Configura tu negocio', text: 'Agrega sucursales, personal, productos e inventario desde tu panel.' },
  { n: '3', title: 'Comparte tu enlace', text: 'Envía tu URL a tus clientes: verán tu catálogo y podrán reservar o comprar.' },
];

export const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [code, setCode] = useState('');
  const isClient = !!user?.roles?.includes('CLIENTE');
  const home = isClient ? '/account' : '/dashboard';

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toLowerCase();
    if (c) navigate(`/t/${c}`);
  };

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", background: 'var(--atemporal-cream, #F5F2EB)', color: '#182D2A', minHeight: '100vh' }}>
      <style>{`
        .lp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
        .lp-grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .lp-card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 24px rgba(24,45,42,0.06); }
        .lp-btn { display: inline-block; padding: 13px 26px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 0.95rem; border: none; cursor: pointer; font-family: inherit; }
        .lp-btn.gold { background: #C9904A; color: #fff; }
        .lp-btn.ghost { background: transparent; color: #F5F2EB; border: 1.5px solid rgba(245,242,235,0.4); }
        .lp-h2 { font-size: clamp(1.5rem, 4vw, 2.1rem); margin: 0 0 8px; text-align: center; }
        .lp-sub { text-align: center; color: #6b7280; margin: 0 auto 36px; max-width: 560px; }
      `}</style>

      <header style={{ background: '#182D2A' }}>
        <div className="lp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: '#C9904A', fontWeight: 900, letterSpacing: 3, textDecoration: 'none', fontSize: '1.3rem' }}>DRESSED</Link>
          <nav style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/pricing" style={{ color: '#CFC1A5', textDecoration: 'none', fontSize: '0.9rem', padding: '0 8px' }}>Planes</Link>
            {isAuthenticated ? (
              <Link to={home} className="lp-btn gold" style={{ padding: '9px 18px' }}>{isClient ? 'Mi cuenta' : 'Ir a mi panel'}</Link>
            ) : (
              <>
                <Link to="/login" style={{ color: '#F5F2EB', textDecoration: 'none', fontSize: '0.9rem', padding: '0 8px' }}>Iniciar sesión</Link>
                <Link to="/saas/register" className="lp-btn gold" style={{ padding: '9px 18px' }}>Registrar mi empresa</Link>
              </>
            )}
          </nav>
        </div>

        <div className="lp-wrap" style={{ padding: '56px 20px 72px', textAlign: 'center', color: '#F5F2EB' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,144,74,0.16)', color: '#C9904A', padding: '6px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1 }}>
            <Store size={14} /> SOFTWARE PARA TIENDAS DE ROPA
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)', lineHeight: 1.1, margin: '18px auto 14px', maxWidth: 800 }}>
            Gestiona tu tienda de moda y véndela en línea con tu propio enlace
          </h1>
          <p style={{ color: 'rgba(245,242,235,0.75)', maxWidth: 620, margin: '0 auto 28px', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Inventario, punto de venta, sucursales, reportes y un catálogo online para tus clientes. Todo en una sola plataforma.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/saas/register" className="lp-btn gold">Empieza gratis</Link>
            <Link to="/pricing" className="lp-btn ghost">Ver planes</Link>
          </div>
        </div>
      </header>

      <section className="lp-wrap" style={{ padding: '64px 20px 24px' }}>
        <h2 className="lp-h2">Todo lo que necesita tu negocio</h2>
        <p className="lp-sub">Una plataforma pensada para el día a día de una tienda de ropa.</p>
        <div className="lp-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-card">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(201,144,74,0.14)', color: '#C9904A', display: 'grid', placeItems: 'center', marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>{f.title}</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.92rem', lineHeight: 1.5 }}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-wrap" style={{ padding: '48px 20px 24px' }}>
        <h2 className="lp-h2">Cómo funciona</h2>
        <p className="lp-sub">Tu tienda online lista en minutos.</p>
        <div className="lp-grid">
          {STEPS.map((s) => (
            <div key={s.n} className="lp-card">
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#182D2A', color: '#C9904A', display: 'grid', placeItems: 'center', fontWeight: 800, marginBottom: 12 }}>{s.n}</div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>{s.title}</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.92rem', lineHeight: 1.5 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-wrap" style={{ padding: '48px 20px 64px' }}>
        <div style={{ background: '#182D2A', borderRadius: 20, padding: '36px 24px', color: '#F5F2EB', textAlign: 'center' }}>
          <Building2 size={28} color="#C9904A" />
          <h2 style={{ margin: '10px 0 6px', fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)' }}>¿Eres cliente de una tienda?</h2>
          <p style={{ color: 'rgba(245,242,235,0.75)', margin: '0 auto 18px', maxWidth: 520, fontSize: '0.95rem' }}>
            Abre el enlace que te compartió tu tienda o escribe su código para ver su catálogo.
          </p>
          <form onSubmit={go} style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="codigo-de-la-tienda"
              style={{ padding: '12px 14px', borderRadius: 10, border: 'none', fontSize: '1rem', fontFamily: 'monospace', width: 260, maxWidth: '100%' }}
            />
            <button type="submit" disabled={!code.trim()} className="lp-btn gold" style={{ opacity: code.trim() ? 1 : 0.5 }}>Ver catálogo</button>
          </form>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(24,45,42,0.1)', padding: '22px 20px', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
        © {new Date().getFullYear()} DRESSED · Plataforma para tiendas de moda
      </footer>
    </div>
  );
};
