import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from '../../api/axios';

export const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const tenantSlug = (params.get('tenant') ?? '').trim().toLowerCase();
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storeError, setStoreError] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  useEffect(() => {
    if (!tenantSlug) return;
    api.get(`/saas/tenants/by-slug/${encodeURIComponent(tenantSlug)}`)
      .then((r) => setStoreName(r.data.name))
      .catch(() => setStoreError(true));
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/register', { name, lastName, email, password, phone }, { headers: { 'X-Tenant-Slug': tenantSlug } });
      login(res.data.accessToken, res.data.user);
      
      const pendingReservationStr = sessionStorage.getItem('pendingReservation');
      if (pendingReservationStr) {
        try {
          const pendingReservation = JSON.parse(pendingReservationStr);
          navigate(`/t/${tenantSlug}/reservations/new`, { state: pendingReservation, replace: true });
          return;
        } catch (e) {
          console.error('Error parsing pendingReservation', e);
        }
      }
      
      navigate(`/t/${tenantSlug}`);
    } catch (err: any) {
      console.error(err);
      if (err.response?.data?.code === 'CLIENT_EXISTS_WITHOUT_DIGITAL_ACCOUNT') {
        setError('CLIENT_EXISTS_WITHOUT_DIGITAL_ACCOUNT');
      } else {
        setError(err.response?.data?.message || 'Error al registrar la cuenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!tenantSlug || storeError) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F5F2EB', fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <form
          onSubmit={(e) => { e.preventDefault(); if (codeInput.trim()) navigate(`/register?tenant=${codeInput.trim().toLowerCase()}`); }}
          style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 18, padding: '32px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}
        >
          <h2 style={{ margin: '0 0 8px', color: '#182D2A' }}>¿En qué tienda quieres registrarte?</h2>
          <p style={{ margin: '0 0 18px', color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {storeError ? <>No encontramos la tienda <b>{tenantSlug}</b>. </> : null}
            Tu cuenta pertenece a la tienda donde compras. Abre el enlace que te compartió tu tienda o escribe su código.
          </p>
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="código-de-la-tienda" autoFocus
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '1rem', marginBottom: 14, fontFamily: 'monospace' }} />
          <button type="submit" disabled={!codeInput.trim()} style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 10, background: '#182D2A', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: codeInput.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>Continuar</button>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.85rem' }}><Link to="/" style={{ color: '#9ca3af' }}>Volver al inicio</Link></p>
        </form>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand-info" style={{ textAlign: 'center' }}>
          <h1>{storeName ?? 'DRESSED'}</h1>
          <p>{storeName ? 'Crea tu cuenta para comprar y reservar.' : 'Tu tienda de ropa en línea.'}</p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-box" style={{ maxHeight: '100%', overflowY: 'auto', padding: '10px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ marginTop: '10px' }}>Crear Cuenta</h2>
            <p className="subtitle">{storeName ? `Regístrate en ${storeName} para hacer reservas y compras` : 'Regístrate para hacer reservas y compras'}</p>
          </div>

          {error === 'CLIENT_EXISTS_WITHOUT_DIGITAL_ACCOUNT' ? (
            <div style={{ color: '#065f46', backgroundColor: '#d1fae5', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Ya eres cliente de nuestra tienda.</p>
              <p style={{ marginBottom: '15px' }}>Para realizar compras online, necesitas activar tu cuenta digital.</p>
              <button
                type="button"
                onClick={() => navigate(`/activate-account${tenantSlug ? `?tenant=${tenantSlug}` : ''}`)}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                Activar mi cuenta
              </button>
            </div>
          ) : error ? (
            <div style={{ color: '#991b1b', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ingresa tu nombre"
                required
              />
            </div>

            <div className="input-group">
              <label>Apellidos</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ingresa tus apellidos"
                required
              />
            </div>

            <div className="input-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>

            <div className="input-group">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>

            <div className="input-group">
              <label>Teléfono (opcional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Tu teléfono"
              />
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrarme'}
            </button>

            <div className="register-link" style={{ marginTop: '15px' }}>
              ¿Ya tienes cuenta? <Link to={`/login?tenant=${tenantSlug}`}>Inicia sesión</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
