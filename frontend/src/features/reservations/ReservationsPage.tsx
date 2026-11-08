import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/axios';
import '../../styles/store.css';

export const ReservationsPage = () => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/reservations/my');
      setReservations(data);
    } catch (err: any) {
      setError('Error al cargar tus reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const payment = searchParams.get('payment');

    const initialize = async () => {
      if (sessionId && payment === 'success') {
        try {
          await api.post(`/reservations/reconcile-session/${sessionId}`);
          // Remove params from URL to avoid re-triggering
          searchParams.delete('session_id');
          searchParams.delete('payment');
          setSearchParams(searchParams);
        } catch (e) {
          console.error('Error reconciling session:', e);
        }
      }
      fetchReservations();
    };

    initialize();
  }, [searchParams, setSearchParams]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('¿Estás seguro que deseas cancelar esta reserva?')) return;
    try {
      await api.patch(`/reservations/${id}`, { status: 'CANCELADA' });
      fetchReservations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al cancelar');
    }
  };



  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDIENTE': return '#ffc107';
      case 'CONFIRMADA': return '#17a2b8';
      case 'PREPARANDO': return '#007bff';
      case 'LISTA': return '#28a745';
      case 'ATENDIDA': return '#6c757d';
      case 'CANCELADA': return '#dc3545';
      default: return '#666';
    }
  };

  return (
    <div className="home-page" style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: '#333' }}>Mis Reservas</h1>

      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '15px', borderRadius: '4px' }}>{error}</div>
      ) : reservations.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <p style={{ fontSize: '1.2rem', color: '#666' }}>No tienes reservas actualmente.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {reservations.map(res => (
            <div key={res.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', color: '#333' }}>Reserva #{res.id}</h3>
                  <span style={{ fontSize: '0.9rem', color: '#888' }}>Realizada el {new Date(res.registrationDate).toLocaleDateString()}</span>
                </div>
                <div style={{ padding: '5px 12px', borderRadius: '20px', backgroundColor: getStatusColor(res.status), color: '#fff', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  {res.status}
                </div>
              </div>

              <div>
                <p style={{ margin: '0 0 5px 0' }}><strong>Fecha de recojo:</strong> {res.date} {res.approximateTime && `a las ${res.approximateTime}`}</p>
                <p style={{ margin: '0 0 5px 0' }}><strong>Sucursal:</strong> {res.branch?.name}</p>
              </div>

              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#555' }}>Artículos:</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {res.items.map((item: any) => (
                    <li key={item.id} style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {item.quantity}x <strong>{item.variant.product.name}</strong> (Talla: {item.variant.size.name}, Color: {item.variant.color.name})
                      </span>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>Bs. {(item.quantity * item.variant.product.price).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {res.paymentSummary && (
                <div style={{ backgroundColor: '#f4f6f8', padding: '15px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', fontSize: '0.9rem' }}>
                  <div><strong>Total:</strong> <br/> Bs. {res.paymentSummary.total}</div>
                  <div><strong>Pagado:</strong> <br/> Bs. {res.paymentSummary.paidAmount}</div>
                  <div><strong>Saldo:</strong> <br/> Bs. {res.paymentSummary.remainingAmount}</div>
                  <div><strong>Estado pago:</strong> <br/> <span style={{ fontWeight: 'bold', color: res.paymentSummary.paymentState === 'PAGADO' ? '#28a745' : res.paymentSummary.paymentState === 'PARCIAL' ? '#fd7e14' : '#dc3545' }}>{res.paymentSummary.paymentState}</span></div>
                </div>
              )}

              {res.status !== 'CANCELADA' && res.status !== 'ATENDIDA' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-outline"
                    style={{ borderColor: '#dc3545', color: '#dc3545' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc3545'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#dc3545'; }}
                    onClick={() => handleCancel(res.id)}
                  >
                    Cancelar Reserva
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
