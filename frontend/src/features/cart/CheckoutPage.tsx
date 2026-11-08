import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from './CartContext';

import { api } from '../../api/axios';

export const CheckoutPage = () => {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<'IDLE' | 'VALIDATING' | 'SUCCESS' | 'TIMEOUT'>('IDLE');

  const sessionId = searchParams.get('session_id');

  // Handle Success Flow
  useEffect(() => {
    let intervalId: any;
    let timeoutId: any;
    let isDone = false;

    const validatePayment = async () => {
      if (isDone) return;
      try {
        const mySalesRes = await api.get('/sales/my');
        const latestSaleId = mySalesRes.data[0]?.id;
        
        if (!latestSaleId) return;

        const saleRes = await api.get(`/sales/my/${latestSaleId}`);
        const sale = saleRes.data;

        const isCompleted = sale.status === 'COMPLETADA';
        const isPaymentApproved = sale.payments && sale.payments.some((p: any) => p.status === 'APROBADO');

        if (isCompleted && isPaymentApproved) {
          isDone = true;
          clearCart();
          setValidationStatus('SUCCESS');
          clearInterval(intervalId);
          clearTimeout(timeoutId);
        }
      } catch (err) {
        console.error('Error validating payment:', err);
      }
    };

    if (sessionId) {
      setValidationStatus('VALIDATING');
      validatePayment(); // first check
      
      intervalId = setInterval(validatePayment, 3000);

      timeoutId = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          clearInterval(intervalId);
          setValidationStatus(prev => prev === 'SUCCESS' ? 'SUCCESS' : 'TIMEOUT');
        }
      }, 20000);
    }

    return () => {
      isDone = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sessionId, clearCart]);

  if (sessionId) {
    if (validationStatus === 'VALIDATING') {
      return (
        <div style={{ maxWidth: '600px', margin: '60px auto', padding: '40px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '2rem', color: '#0056b3', marginBottom: '20px' }}>⏳</div>
          <h1 style={{ color: '#333', marginBottom: '15px' }}>Validando pago...</h1>
          <p style={{ color: '#666', marginBottom: '30px', fontSize: '1.1rem' }}>Por favor, espera un momento mientras confirmamos tu transacción.</p>
        </div>
      );
    }

    if (validationStatus === 'TIMEOUT') {
      return (
        <div style={{ maxWidth: '600px', margin: '60px auto', padding: '40px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '3rem', color: '#ffc107', marginBottom: '20px' }}>⏳</div>
          <h1 style={{ color: '#333', marginBottom: '15px' }}>Pago en proceso</h1>
          <p style={{ color: '#666', marginBottom: '30px', fontSize: '1.1rem' }}>Tu pago está siendo procesado. Revisa Mis Compras.</p>
          <button 
            onClick={() => navigate('/account/purchases')}
            style={{ padding: '12px 25px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Ir a Mis Compras
          </button>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '40px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '4rem', color: '#28a745', marginBottom: '20px' }}>✓</div>
        <h1 style={{ color: '#333', marginBottom: '15px' }}>¡Compra Completada!</h1>
        <p style={{ color: '#666', marginBottom: '30px', fontSize: '1.1rem' }}>Tu pago ha sido procesado exitosamente. Gracias por tu compra.</p>
        <button 
          onClick={() => navigate('/account/purchases')}
          style={{ padding: '12px 25px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Ver mis compras
        </button>
      </div>
    );
  }

  // Handle Normal Flow
  if (!cart.branchId || cart.items.length === 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', textAlign: 'center' }}>
        <h2>Tu carrito está vacío o no has seleccionado sucursal.</h2>
        <button onClick={() => navigate('/cart')} style={{ padding: '10px 20px', marginTop: '20px' }}>Volver al carrito</button>
      </div>
    );
  }

  const subtotal = cart.items.reduce((acc, item) => acc + (item.basePrice || item.price) * item.quantity, 0);
  const total = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = subtotal - total;

  const handlePay = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = {
        branchId: cart.branchId,
        items: cart.items.map(i => ({ variantId: i.variantId, quantity: i.quantity }))
      };

      const res = await api.post('/sales/checkout', payload);
      if (res.data && res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        throw new Error('No se pudo generar la sesión de pago');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al procesar el pago. Por favor, intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: '2.2rem', color: '#333', marginBottom: '10px' }}>Checkout</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>Verifica tu pedido antes de pagar.</p>

      {error && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '12px 15px', borderRadius: '4px', marginBottom: '20px', fontWeight: '500' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 600px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee', overflow: 'hidden' }}>
            <div style={{ padding: '15px 20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#333' }}>
              Sucursal: {cart.branchName}
            </div>
            
            <div style={{ padding: '20px' }}>
              {cart.items.map(item => (
                <div key={item.variantId} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f5f5f5', paddingBottom: '15px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ width: '60px', height: '60px', backgroundColor: '#f8f9fa', borderRadius: '4px', overflow: 'hidden' }}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.6rem' }}>Sin foto</div>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>{item.productName}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Talla: {item.size} | Color: {item.color}</p>
                      <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#555' }}>Cant: {item.quantity}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#0056b3' }}>
                      Bs. {Number(item.price * item.quantity).toFixed(2)}
                    </p>
                    {item.basePrice && item.basePrice > item.price && (
                      <p style={{ margin: 0, fontSize: '0.8rem', textDecoration: 'line-through', color: '#999' }}>
                        Bs. {Number(item.basePrice * item.quantity).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: '1 1 300px' }}>
          <div style={{ backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '8px', border: '1px solid #eee' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>Resumen</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#555' }}>
              <span>Subtotal</span>
              <span>Bs. {subtotal.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#28a745' }}>
                <span>Descuento</span>
                <span>- Bs. {discount.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #ddd', fontSize: '1.25rem', fontWeight: 'bold', color: '#333' }}>
              <span>Total</span>
              <span style={{ color: '#0056b3' }}>Bs. {total.toFixed(2)}</span>
            </div>

            <button
              onClick={handlePay}
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                marginTop: '25px',
                backgroundColor: loading ? '#6c757d' : '#0056b3',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1.05rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Redirigiendo a Stripe...' : 'PAGAR CON STRIPE'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#777', marginTop: '10px' }}>Pago 100% seguro por Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
};
