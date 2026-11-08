import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';

export const ActivateAccountPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await api.post('/auth/request-account-activation', { email });
      setSuccess('Código enviado. Revisa tu correo electrónico (incluyendo spam).');
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al solicitar el código.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await api.post('/auth/activate-account', { email, code, password });
      setSuccess('Cuenta activada exitosamente. Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al activar la cuenta.');
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
        <div className="login-box">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img

              alt="ATEMPORAL"
              style={{ maxHeight: '70px', width: 'auto', objectFit: 'contain', borderRadius: '6px' }}
            />
            <h2 style={{ marginTop: '10px' }}>Activar Cuenta</h2>
            <p className="subtitle">
              {step === 1
                ? 'Ingresa tu correo para recibir un código de activación'
                : 'Ingresa el código que enviamos a tu correo'}
            </p>
          </div>

          {error && <div style={{ color: '#991b1b', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
          {success && <div style={{ color: '#065f46', backgroundColor: '#d1fae5', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>{success}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestCode}>
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

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? 'Solicitando...' : 'Solicitar Código'}
              </button>

              <div className="register-link" style={{ marginTop: '15px', textAlign: 'center' }}>
                <button type="button" onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--atemporal-gold)', cursor: 'pointer', fontWeight: 'bold' }}>
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleActivate}>
              <div className="input-group">
                <label>Código de Activación (6 dígitos)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={6}
                />
              </div>

              <div className="input-group">
                <label>Nueva Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <div className="input-group">
                <label>Confirmar Contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? 'Activando...' : 'Activar Cuenta'}
              </button>

              <div className="register-link" style={{ marginTop: '15px', textAlign: 'center' }}>
                <button type="button" onClick={() => { setStep(1); setError(null); setSuccess(null); }} style={{ background: 'none', border: 'none', color: 'var(--atemporal-gold)', cursor: 'pointer', fontWeight: 'bold' }}>
                  Volver atrás
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
