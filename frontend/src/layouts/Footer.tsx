import { Link } from 'react-router-dom';
import { useStore } from '../features/store/StoreContext';
import '../styles/store.css';

export const Footer = () => {
  const { store } = useStore();
  const name = store?.name ?? '';
  const cfg = store?.config;

  return (
    <footer className="store-footer">
      <div className="store-footer-content" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '24px' }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontWeight: 'bold', letterSpacing: '1px', fontSize: '1.05rem' }}>{name}</div>
          <div style={{ opacity: 0.6, fontSize: '0.82rem', marginTop: 4 }}>Compra y reserva en línea</div>
        </div>
        {cfg?.showBranches !== false && !!store?.branches?.length && (
          <div style={{ display: 'grid', gap: 8, fontSize: '0.85rem' }}>
            <b style={{ letterSpacing: '0.06em', fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.6 }}>Nuestras sucursales</b>
            {store.branches.map((b) => (
              <div key={b.name}>
                <b>{b.name}</b>{b.city ? ` · ${b.city}` : ''}
                <div style={{ opacity: 0.65 }}>{[b.address, b.phone].filter(Boolean).join(' · ')}</div>
              </div>
            ))}
          </div>
        )}
        {(cfg?.whatsapp || cfg?.instagram) && (
          <div style={{ display: 'grid', gap: 8, fontSize: '0.85rem' }}>
            <b style={{ letterSpacing: '0.06em', fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.6 }}>Contáctanos</b>
            {cfg.whatsapp && <a href={`https://wa.me/${cfg.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>WhatsApp {cfg.whatsapp}</a>}
            {cfg.instagram && <a href={`https://instagram.com/${cfg.instagram}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Instagram @{cfg.instagram}</a>}
          </div>
        )}
      </div>
      <p className="store-footer-copyright" style={{ marginTop: '18px' }}>
        &copy; {new Date().getFullYear()} {name}. Todos los derechos reservados. ·{' '}
        <Link to="/" style={{ color: 'inherit', opacity: 0.75 }}>Tienda creada con DRESSED</Link>
      </p>
    </footer>
  );
};
