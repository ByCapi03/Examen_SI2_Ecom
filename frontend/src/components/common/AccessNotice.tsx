import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

type Kind = 'SUSPENDED' | 'EXPIRED';

/** Soporte de la plataforma (opcional): VITE_SUPPORT_EMAIL en el frontend. */
const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;

/**
 * Aviso a pantalla completa cuando la empresa está SUSPENDIDA o su suscripción VENCIÓ.
 * Lo dispara el interceptor de Axios (evento `dressed:access`).
 */
export const AccessNotice = () => {
  const [kind, setKind] = useState<Kind | null>(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = !!user?.roles?.includes('ADMIN');

  useEffect(() => {
    const h = (e: Event) => setKind((e as CustomEvent).detail?.kind ?? null);
    window.addEventListener('dressed:access', h);
    return () => window.removeEventListener('dressed:access', h);
  }, []);

  if (!kind) return null;
  const suspended = kind === 'SUSPENDED';

  const close = () => setKind(null);
  const leave = () => { setKind(null); logout(); window.location.href = '/login'; };

  return (
    <div role="alertdialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,16,15,0.7)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 18, maxWidth: 460, width: '100%', padding: '30px 28px', textAlign: 'center', fontFamily: "'Outfit', system-ui, sans-serif", boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ fontSize: '2.4rem' }}>{suspended ? '⛔' : '⏳'}</div>
        <h2 style={{ margin: '8px 0 10px', color: '#182D2A' }}>{suspended ? 'Tu empresa está suspendida' : 'La suscripción de tu empresa venció'}</h2>
        <p style={{ margin: '0 0 8px', color: '#4b5563', lineHeight: 1.55, fontSize: '0.95rem' }}>
          {suspended
            ? 'El acceso de tu empresa fue suspendido por la plataforma, por lo que no puedes usar el sistema por ahora.'
            : isAdmin
              ? 'Mientras no renueves tu plan no podrás crear sucursales, productos ni usuarios, y se desactivan las funciones de tu plan (reportes, IA y analítica).'
              : 'Mientras no se renueve, no podrás crear sucursales, productos ni usuarios. Avisa al administrador de tu empresa para que la renueve.'}
        </p>
        {suspended && (
          <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '0.88rem' }}>
            Comunícate con el administrador de tu empresa o con el soporte de la plataforma{SUPPORT ? <> (<a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>)</> : null} para reactivarla.
          </p>
        )}
        {!suspended && <div style={{ height: 14 }} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {suspended ? (
            <button onClick={leave} style={btn('#182D2A')}>Cerrar sesión</button>
          ) : (
            <>
              {isAdmin && <button onClick={() => { close(); navigate('/dashboard/subscription'); }} style={btn('#C9904A')}>Renovar plan</button>}
              <button onClick={close} style={btn(isAdmin ? '#6b7280' : '#182D2A')}>Entendido</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' });
