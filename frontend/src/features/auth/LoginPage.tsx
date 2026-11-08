import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from './AuthContext';
import atemporalLogo from '../../assets/ATEMPORAL.png';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: 'admin@ecommerce.com',
    password: 'admin123'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/login', formData);
      login(data.accessToken, data.user);

      if (data.user.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

      if (data.user.roles.includes('ADMIN') || data.user.roles.includes('ENCARGADO') || data.user.roles.includes('CAJERO')) {
        navigate('/dashboard', { replace: true });
      } else {
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

        const redirectUrl = sessionStorage.getItem('redirectUrl');
        if (redirectUrl) {
          sessionStorage.removeItem('redirectUrl');
          navigate(redirectUrl, { replace: true });
          return;
        }

        navigate('/account', { replace: true });
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError(err.response?.data?.message || 'Correo o contraseña incorrectos');
      } else {
        setError('Error al intentar iniciar sesión');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand-info" style={{ textAlign: 'center' }}>
          <img
            src={atemporalLogo}
            alt="ATEMPORAL - Moda que trasciende épocas"
            style={{ maxWidth: '240px', width: '100%', height: 'auto', objectFit: 'contain', marginBottom: '15px', borderRadius: '8px' }}
          />
          <h1>ATEMPORAL</h1>
          <p>Moda que trasciende épocas.</p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-box">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>

            <h2 style={{ marginTop: '10px' }}>Bienvenido de nuevo</h2>
            <p className="subtitle">Ingresa tus credenciales para continuar</p>
          </div>

          {error && (
            <div style={{ color: '#991b1b', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="ejemplo@correo.com"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="options">
              <label className="remember">
                <input type="checkbox" name="remember" />
                <span>Recordarme</span>
              </label>
              <a href="#" className="forgot-password">¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" className="btn-login" disabled={isSubmitting}>
              {isSubmitting ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="register-link">
            ¿No tienes una cuenta? <a href="/register">Regístrate aquí</a>
          </div>
          <div className="register-link" style={{ marginTop: '10px' }}>
            ¿Ya compraste en nuestra tienda? <br />
            <a href="/activate-account">Activa tu cuenta digital</a>
          </div>
        </div>
      </div>
    </div>
  );
};
