import { Link } from 'react-router-dom';
import { useCart } from '../features/cart/CartContext';
import { useAuth } from '../features/auth/AuthContext';
import atemporalLogo from '../assets/ATEMPORAL.png';
import '../styles/store.css';

export const Navbar = () => {
  const { totalItems } = useCart();
  const { isAuthenticated } = useAuth();

  return (
    <nav className="store-navbar">
      <div className="store-navbar-logo">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img 
            src={atemporalLogo} 
            alt="ATEMPORAL - Moda que trasciende épocas" 
            style={{ height: '42px', objectFit: 'contain', borderRadius: '4px' }} 
          />
        </Link>
      </div>
      <div className="store-navbar-links">
        <Link to="/">Inicio</Link>
        <Link to="/catalog">Catálogo</Link>
        <Link to="/cart">Carrito {totalItems > 0 ? `(${totalItems})` : ''}</Link>
        <Link to={isAuthenticated ? "/account" : "/login"}>Mi Cuenta</Link>
        <Link
          to="/pricing"
          style={{
            background: '#c8963e',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '20px',
            fontWeight: 600,
            fontSize: '0.82rem',
            letterSpacing: '0.03em',
            textDecoration: 'none',
          }}
        >
          Registrar empresa
        </Link>
      </div>
    </nav>
  );
};
