import { useAuth } from '../auth/AuthContext';

export const AccountProfile = () => {
  const { user } = useAuth();

  return (
    <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      <h2 style={{ marginTop: 0, color: '#1c2a28' }}>Mi Perfil</h2>
      <p style={{ color: '#666' }}>Bienvenido a tu panel de control, {user?.name}.</p>
      
      <div style={{ marginTop: '30px' }}>
        <div style={{ marginBottom: '15px' }}>
          <strong>Nombre:</strong> {user?.name}
        </div>
        <div style={{ marginBottom: '15px' }}>
          <strong>Correo electrónico:</strong> {user?.email}
        </div>
      </div>
    </div>
  );
};
