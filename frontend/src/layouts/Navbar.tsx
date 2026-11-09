import { Link } from 'react-router-dom';
import { useCart } from '../features/cart/CartContext';
import { useAuth } from '../features/auth/AuthContext';
import { useStore } from '../features/store/StoreContext';
import '../styles/store.css';

const monogram = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const Navbar = () => {
  const { totalItems } = useCart();
  const { isAuthenticated } = useAuth();
  const { store, slug, path } = useStore();
  const name = store?.name ?? '';

  return (
    <nav className="store-navbar">
      <div className="store-navbar-logo">
        <Link to={path('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(201,144,74,0.18)', color: '#C9904A', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.95rem', letterSpacing: 1 }}>{monogram(name)}</span>
          <span style={{ color: 'var(--atemporal-cream, #F5F2EB)', fontWeight: 700, fontSize: '1.05rem', letterSpacing: 1 }}>{name}</span>
        </Link>
      </div>
      <div className="store-navbar-links">
        <Link to={path('/')}>Inicio</Link>
        <Link to={path('/catalog')}>Catálogo</Link>
        <Link to={path('/cart')}>Carrito {totalItems > 0 ? `(${totalItems})` : ''}</Link>
        <Link to={isAuthenticated ? '/account' : `/login?tenant=${slug}`}>Mi Cuenta</Link>
      </div>
    </nav>
  );
};
