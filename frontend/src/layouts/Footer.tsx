import atemporalLogo from '../assets/ATEMPORAL.png';
import '../styles/store.css';

export const Footer = () => {
  return (
    <footer className="store-footer">
      <div className="store-footer-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div className="store-footer-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src={atemporalLogo} 
            alt="ATEMPORAL" 
            style={{ height: '36px', objectFit: 'contain', borderRadius: '4px' }} 
          />
          <span style={{ fontWeight: 'bold', letterSpacing: '1px' }}>ATEMPORAL</span>
        </div>
        <div className="store-footer-links">
          <a href="#">Términos y Condiciones</a>
          <a href="#">Política de Privacidad</a>
          <a href="#">Contacto</a>
        </div>
      </div>
      <p className="store-footer-copyright" style={{ marginTop: '15px' }}>
        &copy; {new Date().getFullYear()} ATEMPORAL - Moda que trasciende épocas. Todos los derechos reservados.
      </p>
    </footer>
  );
};
