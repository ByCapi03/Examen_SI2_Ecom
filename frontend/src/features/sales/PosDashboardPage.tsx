import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';

interface CashSessionData {
  status: 'OPEN' | 'CLOSED';
  session: {
    id: number;
    openingAmount: string;
    openedAt: string;
    summary?: {
      cashSales: number;
      cardSales: number;
      qrSales: number;
      totalVendido: number;
      expectedAmount: number;
    };
  } | null;
  branch: {
    id: number;
    code: string;
    name: string;
  };
}

export const PosDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<CashSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  
  const [closingAmount, setClosingAmount] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  
  const [reservasListas, setReservasListas] = useState(0);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cash-sessions/current');
      setData(res.data);

      const resReservas = await api.get('/reservations');
      const listas = resReservas.data.filter((r: any) => r.status === 'LISTA').length;
      setReservasListas(listas);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al obtener sesión de caja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const amount = Number(openingAmount);
    if (isNaN(amount) || amount < 0) {
      setError('El monto debe ser un número válido mayor o igual a 0');
      return;
    }

    try {
      await api.post('/cash-sessions/open', { openingAmount: amount });
      await fetchSession();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al aperturar caja');
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const amount = Number(closingAmount);
    if (isNaN(amount) || amount < 0) {
      setError('El monto de cierre debe ser un número válido mayor o igual a 0');
      return;
    }

    if (!window.confirm('¿Está seguro de cerrar la caja con este monto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setIsClosing(true);
      await api.post('/cash-sessions/close', { closingAmount: amount });
      setClosingAmount('');
      await fetchSession();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cerrar caja');
    } finally {
      setIsClosing(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Cargando estado de caja...</div>;
  if (!data) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  const renderDifference = () => {
    if (!data.session?.summary || closingAmount === '') return null;
    const expected = data.session.summary.expectedAmount;
    const typed = Number(closingAmount) || 0;
    const diff = typed - expected;

    if (diff === 0) return <span style={{ color: 'green', fontWeight: 'bold' }}>CUADRA (Bs. 0.00)</span>;
    if (diff > 0) return <span style={{ color: 'blue', fontWeight: 'bold' }}>SOBRANTE (Bs. +{diff.toFixed(2)})</span>;
    return <span style={{ color: 'red', fontWeight: 'bold' }}>FALTANTE (Bs. {diff.toFixed(2)})</span>;
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>Punto de Venta (POS)</h2>
      
      <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <p><strong>Cajero:</strong> {user?.name}</p>
        <p><strong>Sucursal:</strong> {data.branch.name} ({data.branch.code})</p>
        <p>
          <strong>Estado de Caja:</strong>{' '}
          <span style={{ 
            color: data.status === 'OPEN' ? 'green' : 'red',
            fontWeight: 'bold' 
          }}>
            {data.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
          </span>
        </p>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

      {data.status === 'CLOSED' ? (
        <form onSubmit={handleOpenSession} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Monto Inicial (Bs.)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0" 
              required
              value={openingAmount}
              onChange={e => setOpeningAmount(e.target.value)}
              style={{ padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <button type="submit" style={{ padding: '12px', backgroundColor: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            APERTURAR CAJA
          </button>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
          {/* Panel Izquierdo: Resumen y Venta */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>Resumen de Sesión</h3>
              <p><strong>Abierta el:</strong> {new Date(data.session?.openedAt || '').toLocaleString()}</p>
              <hr />
              <p style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monto Inicial:</span> <strong>Bs. {Number(data.session?.openingAmount).toFixed(2)}</strong>
              </p>
              
              <h4 style={{ margin: '15px 0 5px 0' }}>Ventas</h4>
              <p style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Efectivo:</span> <span>Bs. {data.session?.summary?.cashSales.toFixed(2) || '0.00'}</span>
              </p>
              <p style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>QR:</span> <span>Bs. {data.session?.summary?.qrSales.toFixed(2) || '0.00'}</span>
              </p>
              <p style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>Tarjeta:</span> <span>Bs. {data.session?.summary?.cardSales.toFixed(2) || '0.00'}</span>
              </p>
              <hr />
              <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', color: '#0056b3' }}>
                <strong>Total Vendido:</strong> <strong>Bs. {data.session?.summary?.totalVendido.toFixed(2) || '0.00'}</strong>
              </p>
              
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeeba' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>Reservas</h4>
                <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between', color: '#856404', fontWeight: 'bold' }}>
                  <span>Listas para entrega:</span>
                  <span style={{ backgroundColor: '#ffc107', padding: '2px 8px', borderRadius: '10px' }}>{reservasListas}</span>
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => navigate('/dashboard/pos/terminal')} 
              style={{ padding: '15px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', fontSize: '1.1rem' }}
            >
              IR AL PUNTO DE VENTA
            </button>
          </div>

          {/* Panel Derecho: Cierre de Caja */}
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, color: '#dc3545' }}>Cierre de Caja</h3>
              
              <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, fontSize: '1.2rem' }}>
                  <span>Efectivo Esperado:</span>
                  <strong>Bs. {data.session?.summary?.expectedAmount.toFixed(2) || '0.00'}</strong>
                </p>
                <small style={{ color: '#666' }}>(Monto inicial + Ventas en efectivo)</small>
              </div>

              <form onSubmit={handleCloseSession} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Efectivo Contado (Gaveta) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    required
                    value={closingAmount}
                    onChange={e => setClosingAmount(e.target.value)}
                    placeholder="Ingrese el dinero físico"
                    style={{ padding: '12px', width: '100%', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1.1rem' }}
                  />
                </div>

                <div style={{ padding: '10px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                  <strong>Diferencia: </strong>
                  {renderDifference() || <span>-</span>}
                </div>

                <button 
                  type="submit" 
                  disabled={isClosing || !closingAmount}
                  style={{ 
                    padding: '15px', 
                    backgroundColor: '#dc3545', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    fontWeight: 'bold', 
                    cursor: (isClosing || !closingAmount) ? 'not-allowed' : 'pointer',
                    opacity: (isClosing || !closingAmount) ? 0.7 : 1,
                    fontSize: '1.1rem'
                  }}
                >
                  {isClosing ? 'CERRANDO...' : 'CERRAR CAJA'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
