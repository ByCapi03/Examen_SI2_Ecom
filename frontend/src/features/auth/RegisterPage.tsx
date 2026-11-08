import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from '../../api/axios';
import atemporalLogo from '../../assets/ATEMPORAL.png';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/register', { name, lastName, email, password, phone });
      login(res.data.accessToken, res.data.user);
      
      const pendingReservationStr = sessionStorage.getItem('pendingReservation');
      if (pendingReservationStr) {
        try {
          const pendingReservation = JSON.parse(pendingReservationStr);
          navigate('/reservations/new', { state: pendingReservation, replace: true });
          return;
        } catch (e) {
          console.error('Error parsing pendingReservation', e);
        }
      }
      
      navigate('/');
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

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand-info" style={{ textAlign: 'center' }}>
          <img

            alt="ATEMPORAL - Moda que trasciende épocas"
            style={{ maxWidth: '240px', width: '100%', height: 'auto', objectFit: 'contain', marginBottom: '15px', borderRadius: '8px' }}
          />
          <h1>ATEMPORAL</h1>
          <p>Moda que trasciende épocas.</p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-box" style={{ maxHeight: '100%', overflowY: 'auto', padding: '10px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img
              src={atemporalLogo}
              alt="ATEMPORAL"
              style={{ maxHeight: '70px', width: 'auto', objectFit: 'contain', borderRadius: '6px' }}
            />
            <h2 style={{ marginTop: '10px' }}>Crear Cuenta</h2>
            <p className="subtitle">Regístrate para hacer reservas y compras</p>
          </div>

          {error === 'CLIENT_EXISTS_WITHOUT_DIGITAL_ACCOUNT' ? (
            <div style={{ color: '#065f46', backgroundColor: '#d1fae5', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Ya eres cliente de nuestra tienda.</p>
              <p style={{ marginBottom: '15px' }}>Para realizar compras online, necesitas activar tu cuenta digital.</p>
              <button
                type="button"
                onClick={() => navigate('/activate-account')}
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
              ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
