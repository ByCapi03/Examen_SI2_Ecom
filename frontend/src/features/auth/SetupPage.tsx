import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';

export const SetupPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data } = await api.get('/auth/setup-status');
        if (data.initialized) {
          navigate('/login', { replace: true });
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError('Error de conexión con el servidor.');
        setLoading(false);
      }
    };
    checkStatus();
  }, [navigate]);

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
      await api.post('/auth/setup-admin', formData);
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al configurar el administrador');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center' }}>Cargando...</div>;
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px' }}>
      <h1 style={{ marginBottom: '1rem', color: '#333', fontSize: '24px', fontWeight: 'bold' }}>Configuración Inicial</h1>
      <p style={{ marginBottom: '2rem', color: '#666', fontSize: '14px' }}>
        El sistema no ha sido inicializado. Crea la cuenta del administrador principal.
      </p>

      {error && (
        <div style={{ padding: '10px', marginBottom: '1rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>Nombre Completo</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>Correo Electrónico</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>Contraseña</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: '1rem',
            padding: '10px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isSubmitting ? 'Configurando...' : 'Crear Administrador'}
        </button>
      </form>
    </div>
  );
};
