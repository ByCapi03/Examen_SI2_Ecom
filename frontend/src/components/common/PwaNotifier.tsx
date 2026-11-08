import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { WifiOff, RefreshCw, X } from 'lucide-react';

export const PwaNotifier: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('[PWA] Service Worker registrado exitosamente:', r?.scope);
    },
    onRegisterError(error: any) {
      console.error('[PWA] Error registrando Service Worker:', error);
    },
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Banner de Modo Sin Conexión */}
      {isOffline && (
        <aside
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1f2937',
            color: '#f9fafb',
            padding: '10px 18px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid #374151',
          }}
        >
          <WifiOff size={16} color="#f87171" />
          <span>Estás navegando sin conexión a Internet (Modo Offline)</span>
        </aside>
      )}

      {/* Banner de Actualización de la PWA */}
      {needRefresh && (
        <aside
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            backgroundColor: '#111827',
            color: '#ffffff',
            padding: '14px 18px',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
            zIndex: 10000,
            maxWidth: '340px',
            border: '1px solid #374151',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Actualización disponible</span>
            <button
              onClick={() => setNeedRefresh(false)}
              aria-label="Cerrar aviso de actualización"
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 0 }}
            >
              <X size={16} />
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', lineHeight: 1.4 }}>
            Hay una versión nueva de FASHIONSTORE con mejoras disponibles.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={() => setNeedRefresh(false)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #4b5563',
                color: '#e5e7eb',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Más tarde
            </button>
            <button
              onClick={() => updateServiceWorker(true)}
              style={{
                backgroundColor: '#ffffff',
                border: 'none',
                color: '#111827',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={13} />
              Actualizar
            </button>
          </div>
        </aside>
      )}
    </>
  );
};
