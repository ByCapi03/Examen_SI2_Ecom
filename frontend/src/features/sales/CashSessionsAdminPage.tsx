import { useState, useEffect } from 'react';
import { api } from '../../api/axios';

export const CashSessionsAdminPage = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/cash-sessions');
      setSessions(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar las sesiones');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return `Bs. ${Number(val).toFixed(2)}`;
  };

  if (loading) return <div style={{ padding: '24px' }}>Cargando sesiones...</div>;
  if (error) return <div style={{ padding: '24px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>Sesiones de Caja</h1>
      
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        {sessions.length === 0 ? (
          <p style={{ color: '#666' }}>No hay sesiones de caja para mostrar.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#555' }}>
                <th style={{ padding: '12px 8px' }}>Cajero</th>
                <th style={{ padding: '12px 8px' }}>Sucursal</th>
                <th style={{ padding: '12px 8px' }}>Apertura</th>
                <th style={{ padding: '12px 8px' }}>Monto Aper.</th>
                <th style={{ padding: '12px 8px' }}>Cierre</th>
                <th style={{ padding: '12px 8px' }}>Monto Cierre</th>
                <th style={{ padding: '12px 8px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{s.cashierName}</td>
                  <td style={{ padding: '12px 8px' }}>{s.branchName}</td>
                  <td style={{ padding: '12px 8px' }}>{new Date(s.openedAt).toLocaleString()}</td>
                  <td style={{ padding: '12px 8px' }}>{formatCurrency(s.openingAmount)}</td>
                  <td style={{ padding: '12px 8px' }}>{s.closedAt ? new Date(s.closedAt).toLocaleString() : '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{formatCurrency(s.closingAmount)}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      backgroundColor: s.status === 'OPEN' ? '#e6f4ea' : '#f8d7da',
                      color: s.status === 'OPEN' ? '#1e8e3e' : '#dc3545'
                    }}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
