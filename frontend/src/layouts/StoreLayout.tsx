import { Link, Outlet } from 'react-router-dom';
import { OfflineStatusBar } from '../components/common/OfflineStatusBar';
import { useAuth } from '../features/auth/AuthContext';
import { StoreProvider, useStore } from '../features/store/StoreContext';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--atemporal-cream, #F5F2EB)', fontFamily: "'Outfit', system-ui, sans-serif" }}>
    <div style={{ maxWidth: 460, textAlign: 'center', background: '#fff', borderRadius: 18, padding: '36px 30px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>{children}</div>
  </div>
);

const linkBtn: React.CSSProperties = { display: 'inline-block', padding: '11px 22px', borderRadius: 10, background: '#182D2A', color: '#fff', fontWeight: 700, textDecoration: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' };

/** Estado de la tienda (cargando / no existe / sesión de otra empresa) y estructura común. */
export const StoreShell = ({ children }: { children?: React.ReactNode }) => {
  const { status, store, mismatch, sessionStore, slug } = useStore();
  const { logout } = useAuth();

  if (status === 'loading') return <Centered><p style={{ margin: 0, color: '#6b7280' }}>Cargando tienda…</p></Centered>;

  if (status === 'suspended') {
    return (
      <Centered>
        <h2 style={{ margin: '0 0 8px', color: '#182D2A' }}>Tienda no disponible</h2>
        <p style={{ margin: '0 0 22px', color: '#6b7280', lineHeight: 1.5 }}>Esta tienda no está disponible por el momento. Vuelve a intentarlo más tarde o contacta directamente al negocio.</p>
        <Link to="/" style={linkBtn}>Ir al inicio</Link>
      </Centered>
    );
  }

  if (status === 'offline') {
    return (
      <Centered>
        <h2 style={{ margin: '0 0 8px', color: '#182D2A' }}>Sin conexión</h2>
        <p style={{ margin: '0 0 22px', color: '#6b7280', lineHeight: 1.5 }}>No pudimos cargar la tienda y aún no está guardada en este dispositivo. Conéctate una vez para usarla sin conexión.</p>
        <button onClick={() => window.location.reload()} style={{ ...linkBtn, border: 'none', cursor: 'pointer' }}>Reintentar</button>
      </Centered>
    );
  }

  if (status === 'notfound') {
    return (
      <Centered>
        <h2 style={{ margin: '0 0 8px', color: '#182D2A' }}>Tienda no encontrada</h2>
        <p style={{ margin: '0 0 22px', color: '#6b7280', lineHeight: 1.5 }}>
          {slug ? <>No existe ninguna tienda con el código <b>{slug}</b>. Revisa el enlace que te compartieron.</> : 'Abre el enlace de la tienda que te compartieron.'}
        </p>
        <Link to="/" style={linkBtn}>Ir al inicio</Link>
      </Centered>
    );
  }

  if (store && store.config?.published === false) {
    return (
      <Centered>
        <h2 style={{ margin: '0 0 8px', color: '#182D2A' }}>{store.name}</h2>
        <p style={{ margin: '0 0 22px', color: '#6b7280', lineHeight: 1.5 }}>Esta tienda aún no está disponible. Vuelve pronto.</p>
        <Link to="/" style={linkBtn}>Ir al inicio</Link>
      </Centered>
    );
  }

  if (mismatch && sessionStore) {
    return (
      <Centered>
        <h2 style={{ margin: '0 0 8px', color: '#182D2A' }}>Tienes una sesión de otra empresa</h2>
        <p style={{ margin: '0 0 22px', color: '#6b7280', lineHeight: 1.5 }}>
          Tu sesión pertenece a <b>{sessionStore.name}</b>, pero abriste la tienda de <b>{store?.name}</b>. Cierra tu sesión para ver este catálogo, o vuelve a tu tienda.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={`/t/${sessionStore.slug}`} style={linkBtn}>Ir a {sessionStore.name}</Link>
          <button onClick={() => logout()} style={{ ...linkBtn, background: 'transparent', color: '#182D2A', border: '1.5px solid #d1d5db' }}>Cerrar sesión</button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="store-layout">
      <Navbar />
      <main style={{ minHeight: '80vh', padding: '20px' }}>
        {children ?? <Outlet />}
        <OfflineStatusBar />
      </main>
      <Footer />
    </div>
  );
};

export const StoreLayout = () => (
  <StoreProvider>
    <StoreShell />
  </StoreProvider>
);
