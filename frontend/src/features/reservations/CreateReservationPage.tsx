import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import '../../styles/store.css';

export const CreateReservationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  let state = location.state as any;

  if (!state) {
    const pendingStr = sessionStorage.getItem('pendingReservation');
    if (pendingStr) {
      try {
        state = JSON.parse(pendingStr);
      } catch (e) {
        console.error('Error parsing pending reservation', e);
      }
    }
  }

  useEffect(() => {
    // Ya no limpiamos el sessionStorage automáticamente al cargar.
    // Solo se limpiará después de crear la reserva exitosamente.
  }, [state]);

  if (!state) {
    alert('No se encontraron los datos de la reserva. Por favor selecciona el producto nuevamente.');
    return <Navigate to="/catalog" />;
  }

  const { productName, price, variantId, sizeName, colorName, branchId, branchName } = state;

  const [date, setDate] = useState(state.date || '');
  const [approximateTime, setApproximateTime] = useState(state.approximateTime || '');
  const [quantity, setQuantity] = useState(state.quantity || 1);
  const [paymentOption, setPaymentOption] = useState<'DEPOSIT_30' | 'FULL' | null>(state.paymentOption || null);
  const [paymentMethod, setPaymentMethod] = useState<'TARJETA' | 'QR' | 'BILLETERA_MOVIL'>('TARJETA');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (pendingPayment && paymentStatus !== 'APROBADO' && paymentStatus !== 'RECHAZADO') {
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/payments/${pendingPayment.paymentId}/status`);
          if (res.data.status === 'APROBADO') {
            setPaymentStatus('APROBADO');
            clearInterval(interval);
            setTimeout(() => {
              navigate('/account/reservations');
            }, 2000);
          } else if (res.data.status === 'RECHAZADO' || res.data.expired) {
            setPaymentStatus('RECHAZADO');
            clearInterval(interval);
          }
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pendingPayment, paymentStatus, navigate]);

  const handleSubmit = async () => {
    if (!date) {
      setError('Por favor, selecciona una fecha');
      return;
    }
    if (!paymentOption) {
      setError('Por favor, selecciona una opción de pago');
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem('pendingReservation', JSON.stringify({
        ...state,
        date,
        approximateTime,
        quantity,
        paymentOption
      }));
      setShowAuthModal(true);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const resCreation = await api.post('/reservations', {
        branchId,
        date,
        approximateTime,
        items: [
          { variantId, quantity }
        ],
      });

      const reservationId = resCreation.data.reservationId;

      if (paymentMethod === 'TARJETA') {
        const resPayment = await api.post(`/reservations/${reservationId}/create-payment`, {
          paymentOption,
          clientPlatform: 'web'
        });
        const checkoutUrl = resPayment.data.checkoutUrl;
        sessionStorage.removeItem('pendingReservation');
        window.location.href = checkoutUrl;
      } else if (paymentMethod === 'QR') {
        const resPayment = await api.post(`/payments/qr`, {
          reservationId,
          paymentOption,
          clientPlatform: 'web'
        });
        sessionStorage.removeItem('pendingReservation');
        setPendingPayment(resPayment.data);
        setPaymentStatus('PENDIENTE');
      } else if (paymentMethod === 'BILLETERA_MOVIL') {
        if (!phoneNumber) {
           setError('Ingresa tu número de celular para la billetera móvil');
           setLoading(false);
           return;
        }
        const resPayment = await api.post(`/payments/mobile-wallet`, {
          reservationId,
          paymentOption,
          phoneNumber,
          clientPlatform: 'web'
        });
        sessionStorage.removeItem('pendingReservation');
        setPendingPayment(resPayment.data);
        setPaymentStatus('PENDIENTE');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (action: 'approve' | 'reject') => {
    if (!pendingPayment) return;
    try {
      await api.post(`/payments/${pendingPayment.paymentId}/simulate/${action}`);
      // polling will catch it
    } catch(e:any) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="home-page" style={{ padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff', padding: '30px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '20px', color: '#333' }}>Confirmar Reserva</h1>
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>{productName}</h3>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Talla:</strong> {sizeName} | <strong>Color:</strong> {colorName}</p>
          <p style={{ margin: '5px 0', color: '#666' }}><strong>Sucursal:</strong> {branchName}</p>
          <p style={{ margin: '15px 0 0 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#0056b3' }}>Bs. {Number(price).toFixed(2)}</p>
        </div>

        {error && <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

        <form onSubmit={e => e.preventDefault()}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Fecha de recojo *</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required
              min={new Date().toISOString().split('T')[0]}
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Hora aproximada de recojo</label>
            <input 
              type="time" 
              value={approximateTime} 
              onChange={e => setApproximateTime(e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Cantidad</label>
            <input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={e => setQuantity(Number(e.target.value))} 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#555' }}>Opción de Pago *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div 
                onClick={() => setPaymentOption('DEPOSIT_30')}
                style={{ 
                  padding: '15px', borderRadius: '8px', border: `2px solid ${paymentOption === 'DEPOSIT_30' ? '#17a2b8' : '#ccc'}`,
                  backgroundColor: paymentOption === 'DEPOSIT_30' ? '#e0f7fa' : '#fff', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                <span style={{ fontWeight: 'bold', color: paymentOption === 'DEPOSIT_30' ? '#0056b3' : '#333' }}>PAGAR 30% (Anticipo)</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: paymentOption === 'DEPOSIT_30' ? '#0056b3' : '#333' }}>Bs. {(Number(price) * quantity * 0.3).toFixed(2)}</span>
              </div>
              <div 
                onClick={() => setPaymentOption('FULL')}
                style={{ 
                  padding: '15px', borderRadius: '8px', border: `2px solid ${paymentOption === 'FULL' ? '#28a745' : '#ccc'}`,
                  backgroundColor: paymentOption === 'FULL' ? '#e8f5e9' : '#fff', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                <span style={{ fontWeight: 'bold', color: paymentOption === 'FULL' ? '#155724' : '#333' }}>PAGAR COMPLETO</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: paymentOption === 'FULL' ? '#155724' : '#333' }}>Bs. {(Number(price) * quantity).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#555' }}>Método de Pago *</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setPaymentMethod('TARJETA')} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: paymentMethod === 'TARJETA' ? '2px solid #0056b3' : '1px solid #ccc', backgroundColor: paymentMethod === 'TARJETA' ? '#e6f2ff' : '#fff', cursor: 'pointer' }}>Tarjeta</button>
              <button type="button" onClick={() => setPaymentMethod('QR')} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: paymentMethod === 'QR' ? '2px solid #0056b3' : '1px solid #ccc', backgroundColor: paymentMethod === 'QR' ? '#e6f2ff' : '#fff', cursor: 'pointer' }}>QR</button>
              <button type="button" onClick={() => setPaymentMethod('BILLETERA_MOVIL')} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: paymentMethod === 'BILLETERA_MOVIL' ? '2px solid #0056b3' : '1px solid #ccc', backgroundColor: paymentMethod === 'BILLETERA_MOVIL' ? '#e6f2ff' : '#fff', cursor: 'pointer' }}>Billetera</button>
            </div>
          </div>

          {paymentMethod === 'BILLETERA_MOVIL' && (
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>Número de Celular *</label>
              <input type="text" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="Ej: 71234567" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
          )}

          {!pendingPayment ? (
            <div style={{ marginTop: '20px' }}>
              <button 
                type="button" 
                onClick={() => handleSubmit()}
                disabled={loading || !paymentOption || (paymentMethod === 'BILLETERA_MOVIL' && !phoneNumber)}
                className="btn-primary"
                style={{ padding: '15px', borderRadius: '8px', cursor: (loading || !paymentOption) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', fontWeight: 'bold', width: '100%', opacity: (loading || !paymentOption) ? 0.6 : 1 }}
              >
                {loading ? 'Procesando...' : 'CONTINUAR AL PAGO'}
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
              {paymentStatus === 'APROBADO' && <h3 style={{color:'green'}}>PAGO APROBADO. Redirigiendo...</h3>}
              {paymentStatus === 'RECHAZADO' && <h3 style={{color:'red'}}>PAGO RECHAZADO O EXPIRADO</h3>}
              {paymentStatus === 'PENDIENTE' && (
                <>
                  <h3 style={{ color: '#0056b3' }}>Esperando confirmación...</h3>
                  {paymentMethod === 'QR' && (
                    <div style={{ margin: '20px 0' }}>
                      <p>Escanea este código QR con tu aplicación bancaria:</p>
                      <img src={pendingPayment.qrImage} alt="QR Code" style={{ width: '200px', height: '200px' }} />
                      <p>Monto: Bs. {pendingPayment.amount}</p>
                      <p>Ref: {pendingPayment.reference}</p>
                      
                      <div style={{ marginTop: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                        <p style={{ margin: '0 0 5px 0', color: '#666' }}>URL de confirmación (Para diagnóstico):</p>
                        <code style={{ color: '#0056b3' }}>{pendingPayment.confirmationUrl}</code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(pendingPayment.confirmationUrl);
                            alert('URL copiada al portapapeles');
                          }}
                          style={{ display: 'block', margin: '10px auto 0', padding: '5px 10px', background: '#e2e6ea', border: '1px solid #dae0e5', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Copiar URL
                        </button>
                      </div>
                    </div>
                  )}
                  {paymentMethod === 'BILLETERA_MOVIL' && (
                    <div style={{ margin: '20px 0' }}>
                      <p>Solicitud enviada a tu billetera móvil ({phoneNumber}).</p>
                      <p>Monto: Bs. {pendingPayment.amount}</p>
                      <p>Ref: {pendingPayment.reference}</p>
                    </div>
                  )}
                  {paymentMethod === 'BILLETERA_MOVIL' && (
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                      <button onClick={() => handleSimulate('approve')} style={{ padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Simular Aprobación</button>
                      <button onClick={() => handleSimulate('reject')} style={{ padding: '10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Simular Rechazo</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </form>
      </div>

      {showAuthModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>Inicia sesión para continuar</h3>
            <p style={{ color: '#666', marginBottom: '25px' }}>Para completar tu reserva necesitas una cuenta.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => navigate('/register')}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                CREAR CUENTA
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="btn-outline"
                style={{ width: '100%', padding: '10px', borderRadius: '4px', cursor: 'pointer', border: '1px solid #0056b3', color: '#0056b3', backgroundColor: 'transparent' }}
              >
                YA TENGO CUENTA
              </button>
              <button 
                onClick={() => setShowAuthModal(false)}
                style={{ marginTop: '10px', padding: '10px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
