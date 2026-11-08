import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export const QrPaymentPage: React.FC = () => {
  console.log('[QR PAGE COMPONENT RENDER] Iniciando...');

  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    let isMounted = true;

    const loadInfo = async () => {
      try {
        console.log('[QR PAGE] Cargando URL:', `${API_URL}/payments/qr/confirm/${token}`);

        const res = await fetch(`${API_URL}/payments/qr/confirm/${token}`);
        const data = await res.json();

        if (!isMounted) return;

        if (!res.ok) {
          throw new Error(data.message || 'Error al obtener la información del pago');
        }

        setInfo(data);
        setStatus(data.status);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('[QR CONFIRM LOAD ERROR]', err);
        setError(err.message || 'Error de red o CORS al contactar al servidor');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInfo();

    return () => {
      isMounted = false;
    };
  }, [token, API_URL]);

  const handleAction = async (action: 'confirm' | 'reject') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/payments/qr/${action}/${token}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al procesar la acción');
      }

      setStatus(action === 'confirm' ? 'APROBADO' : 'RECHAZADO');
    } catch (err: any) {
      console.error('[QR ACTION ERROR]', err);
      setError(err.message || 'Error al ejecutar la acción');
    } finally {
      setLoading(false);
    }
  };

  // ERROR BOUNDARY / LOG INICIAL - RENDER SIEMPRE SEGURO
  if (loading && !info) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', color: '#111', padding: 24, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>ATEMPORAL</h2>
        <p>Cargando pago QR...</p>
        <p style={{ fontSize: '0.8rem', color: '#666' }}>Token: {token}</p>
        <p style={{ fontSize: '0.8rem', color: '#666' }}>API: {API_URL}</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto', background: '#fff', minHeight: '100vh', color: '#333' }}>
      <h1>ATEMPORAL</h1>
      <h2>Confirmación de Pago QR</h2>

      {error && (
        <div style={{ padding: '20px', backgroundColor: '#fee', color: '#c00', borderRadius: '8px', margin: '20px 0' }}>
          <h3>Ocurrió un problema</h3>
          <p>{error}</p>
          <p style={{ fontSize: '0.8rem', marginTop: 10 }}>Asegúrate de que estás en la misma red WiFi.</p>
        </div>
      )}

      {status === 'APROBADO' && !error && (
        <div style={{ padding: '20px', color: 'green' }}>
          <h2> Pago confirmado </h2>
          <p>La reserva ha sido procesada con éxito.</p>
          <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>Ya puedes cerrar esta ventana.</p>
        </div>
      )}

      {status === 'RECHAZADO' && !error && (
        <div style={{ padding: '20px', color: 'red' }}>
          <h2> Pago rechazado</h2>
          <p>El pago no pudo ser procesado.</p>
        </div>
      )}

      {info && status !== 'APROBADO' && status !== 'RECHAZADO' && !error && (
        <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', margin: '20px 0', border: '1px solid #eee', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: '1.3rem', color: '#0056b3', margin: '0 0 10px 0' }}>
            <strong>Monto:</strong> Bs. {info.amount}
          </p>
          <p style={{ margin: '5px 0' }}><strong>Referencia:</strong> {info.reference}</p>
          <p style={{ margin: '5px 0' }}><strong>Estado:</strong> {status || 'PENDIENTE'}</p>

          <div style={{ marginTop: '30px' }}>
            <button
              onClick={() => handleAction('confirm')}
              disabled={loading}
              style={{ width: '100%', padding: '15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '15px', boxShadow: '0 4px 6px rgba(40,167,69,0.3)', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Procesando...' : 'CONFIRMAR PAGO'}
            </button>

            <button
              onClick={() => handleAction('reject')}
              disabled={loading}
              style={{ width: '100%', padding: '15px', background: 'transparent', color: '#dc3545', border: '2px solid #dc3545', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: loading ? 0.7 : 1 }}
            >
              RECHAZAR PAGO
            </button>
          </div>
        </div>
      )}

      {!loading && !info && !error && (
        <div style={{ padding: '20px', color: '#666' }}>
          <p>No se pudo cargar la información del código QR.</p>
        </div>
      )}
    </div>
  );
};
