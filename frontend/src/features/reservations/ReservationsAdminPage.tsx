import { useState, useEffect } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { io } from 'socket.io-client';

export const ReservationsAdminPage = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<{ [key: number]: string }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isCajero = user?.roles?.includes('CAJERO') && !user.roles.includes('ADMIN') && !user.roles.includes('ENCARGADO');

  const fetchReservations = async () => {
    try {
      const url = isCajero ? '/reservations?deliveryQueue=true' : '/reservations';
      const { data } = await api.get(url);
      setReservations(data);
    } catch (err) {
      console.error('Error fetching reservations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();

    const handleNewReservation = () => fetchReservations();
    window.addEventListener('RESERVATION_CREATED', handleNewReservation);
    
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');
    
    const token = localStorage.getItem('token');
    if (token) {
      socket.emit('joinBranch', { token });
    }

    socket.on('reservation.attended', (data: any) => {
      if (user?.roles?.includes('ENCARGADO') && data.branchId === user.branchId) {
        setToastMessage(`¡Reserva #${data.reservationId} fue entregada por ${data.cashierName}!`);
        setTimeout(() => setToastMessage(null), 5000);
        fetchReservations();
      }
    });

    socket.on('reservation.ready', (data: any) => {
      if (user?.roles?.includes('CAJERO')) {
        setToastMessage(`¡${data.message}!`);
        setTimeout(() => setToastMessage(null), 5000);
        fetchReservations();
      }
    });

    return () => {
      window.removeEventListener('RESERVATION_CREATED', handleNewReservation);
      socket.disconnect();
    };
  }, [user]);

  const handleDeliver = async (id: number) => {
    if (!window.confirm('¿Confirmar entrega de esta reserva?')) return;
    try {
      await api.post(`/reservations/${id}/deliver`);
      alert('Reserva entregada con éxito');
      fetchReservations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al validar entrega');
    }
  };

  const handlePayAndDeliver = async (id: number) => {
    const method = paymentMethod[id] || 'EFECTIVO';
    if (!window.confirm(`¿Cobrar y entregar reserva con ${method}?`)) return;
    try {
      await api.post(`/reservations/${id}/pay-and-deliver`, { method });
      alert('Reserva cobrada y entregada con éxito');
      fetchReservations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al procesar cobro en caja');
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    if (!window.confirm(`Cambiar estado a ${newStatus}?`)) return;
    try {
      await api.patch(`/reservations/${id}`, { status: newStatus });
      fetchReservations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al actualizar');
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

  const getNextStatuses = (status: string) => {
    const flow = ['PENDIENTE', 'CONFIRMADA', 'PREPARANDO', 'LISTA', 'ATENDIDA'];
    const idx = flow.indexOf(status);
    if (idx === -1 || idx === flow.length - 1) return [];
    return flow.slice(idx + 1);
  };

  if (loading) return <div style={{ padding: '20px' }}>Cargando reservas...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '20px', color: '#333' }}>
        {isCajero ? 'Reservas para Entrega' : `Administración de Reservas ${user?.roles?.includes('ENCARGADO') && !user.roles.includes('ADMIN') ? '(Mi Sucursal)' : ''}`}
      </h1>

      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#28a745', color: '#fff', padding: '15px 20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeIn 0.3s ease-in-out' }}>
          <strong>¡Notificación!</strong> {toastMessage}
        </div>
      )}

      <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        {reservations.length === 0 ? (
          <p style={{ color: '#666' }}>No hay reservas para mostrar.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '12px 8px', color: '#555' }}>ID</th>
                <th style={{ padding: '12px 8px', color: '#555' }}>Cliente</th>
                {!isCajero && <th style={{ padding: '12px 8px', color: '#555' }}>Sucursal</th>}
                <th style={{ padding: '12px 8px', color: '#555' }}>Recojo</th>
                <th style={{ padding: '12px 8px', color: '#555' }}>Artículos</th>
                <th style={{ padding: '12px 8px', color: '#555' }}>Estado Reserva</th>
                {isCajero && <th style={{ padding: '12px 8px', color: '#555' }}>Estado Pago</th>}
                <th style={{ padding: '12px 8px', color: '#555' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map(res => (
                <tr key={res.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 8px' }}>#{res.id}</td>
                  <td style={{ padding: '12px 8px' }}>{res.client?.name} {res.client?.lastName} <br/><small style={{ color: '#888' }}>{res.client?.email}</small></td>
                  {!isCajero && <td style={{ padding: '12px 8px' }}>{res.branch?.name}</td>}
                  <td style={{ padding: '12px 8px' }}>{res.date} <br/> <small>{res.approximateTime}</small></td>
                  <td style={{ padding: '12px 8px' }}>
                    <ul style={{ margin: 0, paddingLeft: '15px' }}>
                      {res.items.map((item: any) => (
                        <li key={item.id} style={{ fontSize: '0.85rem' }}>
                          {item.quantity}x {item.variant.product.name} ({item.variant.size.name})
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: getStatusColor(res.status), color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {res.status}
                    </span>
                  </td>
                  {isCajero && (
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontWeight: 'bold', color: res.paymentSummary?.paymentState === 'PAGADO' ? '#28a745' : res.paymentSummary?.paymentState === 'PARCIAL' ? '#fd7e14' : '#dc3545' }}>
                        {res.paymentSummary?.paymentState || 'PENDIENTE'}
                      </span>
                      <br/>
                      <small style={{ color: '#666' }}>Saldo: Bs. {res.paymentSummary?.remainingAmount || 0}</small>
                    </td>
                  )}
                  <td style={{ padding: '12px 8px' }}>
                    {isCajero ? (
                      res.status === 'LISTA' ? (
                        res.paymentSummary?.paymentState === 'PAGADO' ? (
                          <button 
                            onClick={() => handleDeliver(res.id)}
                            style={{ padding: '6px 12px', backgroundColor: '#28a745', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                          >
                            VALIDAR ENTREGA
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <select 
                              value={paymentMethod[res.id] || 'EFECTIVO'}
                              onChange={(e) => setPaymentMethod({ ...paymentMethod, [res.id]: e.target.value })}
                              style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.8rem' }}
                            >
                              <option value="EFECTIVO">EFECTIVO</option>
                              <option value="TARJETA">TARJETA</option>
                              <option value="QR">QR</option>
                              <option value="BILLETERA_MOVIL">BILLETERA_MOVIL</option>
                            </select>
                            <button 
                              onClick={() => handlePayAndDeliver(res.id)}
                              style={{ padding: '6px 12px', backgroundColor: '#007bff', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}
                            >
                              COBRAR SALDO Y ENTREGAR <br/> (Bs. {res.paymentSummary?.remainingAmount})
                            </button>
                          </div>
                        )
                      ) : null
                    ) : (
                      res.status !== 'CANCELADA' && res.status !== 'ATENDIDA' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <select 
                            value=""
                            onChange={(e) => handleUpdateStatus(res.id, e.target.value)}
                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                          >
                            <option value="" disabled>Avanzar estado...</option>
                            {getNextStatuses(res.status).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <button 
                            onClick={() => handleUpdateStatus(res.id, 'CANCELADA')}
                            style={{ padding: '4px', backgroundColor: '#fff', border: '1px solid #dc3545', color: '#dc3545', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )
                    )}
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
