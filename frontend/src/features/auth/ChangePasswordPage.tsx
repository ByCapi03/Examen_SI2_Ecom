import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from './AuthContext';

export const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !user.mustChangePassword) {
    // If not required to change password, redirect to dashboard or home
    setTimeout(() => {
        if (user?.roles.includes('ADMIN') || user?.roles.includes('ENCARGADO') || user?.roles.includes('CAJERO')) {
            navigate('/dashboard', { replace: true });
        } else {
            navigate('/', { replace: true });
        }
    }, 0);
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Las contraseas no coinciden');
      return;
    }
    if (formData.newPassword.length < 6) {
      setError('La contrasea debe tener al menos 6 caracteres');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { newPassword: formData.newPassword });
      updateUser({ ...user, mustChangePassword: false });
      
      alert('Contrasea cambiada exitosamente');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al intentar cambiar la contrasea');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
        <div className="login-left">
            <div className="brand-info">
                <h1>Boutique Elegance</h1>
                <p>Cambio de contrasea obligatorio por seguridad.</p>
            </div>
        </div>
        <div className="login-right">
            <div className="login-box">
                <h2>Crea tu nueva contrasea</h2>
                <p className="subtitle">Esta contrasea reemplazar a la temporal.</p>
                
                {error && (
                  <div style={{ color: '#991b1b', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="newPassword">Nueva Contrasea</label>
                        <input 
                            type="password" 
                            id="newPassword" 
                            name="newPassword" 
                            value={formData.newPassword} 
                            onChange={handleChange}
                            placeholder="Minimo 6 caracteres" 
                            required 
                            minLength={6}
                        />
                    </div>
                    
                    <div className="input-group">
                        <label htmlFor="confirmPassword">Confirmar Contrasea</label>
                        <input 
                            type="password" 
                            id="confirmPassword" 
                            name="confirmPassword" 
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Minimo 6 caracteres" 
                            required 
                            minLength={6}
                        />
                    </div>
                    
                    <button type="submit" className="btn-login" disabled={isSubmitting}>
                        {isSubmitting ? 'Guardando...' : 'Cambiar Contrasea'}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};
