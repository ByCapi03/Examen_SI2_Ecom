import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { StoreProvider, useStore } from '../features/store/StoreContext';

const AccountContent = () => {
  const { logout } = useAuth();
  const { path, store } = useStore();

  return (
    <div className="store-layout" style={{ backgroundColor: '#f9f9f9', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1, padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
          
          {/* Account Sidebar */}
          <aside style={{ width: '250px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', color: '#1c2a28' }}>Mi Cuenta</h3>
            <Link to={path('/')} style={{ display: 'inline-block', marginBottom: '16px', fontSize: '0.85rem', color: '#ba8141', textDecoration: 'none' }}>
              ← Volver a {store?.name ?? 'la tienda'}
            </Link>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <NavLink 
                to="/account" 
                end
                style={({ isActive }) => ({ textDecoration: 'none', color: isActive ? '#ba8141' : '#333', fontWeight: isActive ? 'bold' : 'normal', padding: '8px 0', borderBottom: '1px solid #eee' })}
              >
                Perfil
              </NavLink>
              <NavLink 
                to="/account/reservations" 
                style={({ isActive }) => ({ textDecoration: 'none', color: isActive ? '#ba8141' : '#333', fontWeight: isActive ? 'bold' : 'normal', padding: '8px 0', borderBottom: '1px solid #eee' })}
              >
                Mis Reservas
              </NavLink>
              <NavLink 
                to="/account/purchases" 
                style={({ isActive }) => ({ textDecoration: 'none', color: isActive ? '#ba8141' : '#333', fontWeight: isActive ? 'bold' : 'normal', padding: '8px 0', borderBottom: '1px solid #eee' })}
              >
                Mis Compras
              </NavLink>
              <button 
                onClick={() => logout()}
                style={{ background: 'none', border: 'none', color: '#dc3545', textAlign: 'left', cursor: 'pointer', padding: '8px 0', fontSize: '1rem', marginTop: '10px' }}
              >
                Cerrar Sesión
              </button>
            </div>
          </aside>

          {/* Account Content */}
          <section style={{ flex: 1, minWidth: '300px' }}>
            <Outlet />
          </section>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export const ClientAccountLayout = () => (
  <StoreProvider>
    <AccountContent />
  </StoreProvider>
);
