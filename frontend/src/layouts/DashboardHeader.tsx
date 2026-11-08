import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../api/axios';
import { messaging, onMessage } from '../config/firebase';
import { useFirebaseNotifications } from '../hooks/useFirebaseNotifications';
interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  reservationId?: number;
  read: boolean;
  createdAt: string;
}

export const DashboardHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { permission, requestPermissionAndRegister, isSupported } = useFirebaseNotifications();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications/my');
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000); // Polling every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (permission === 'granted' && messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[DashboardHeader] onMessage received: ', payload);
        fetchNotifications();
        
        if (payload.data?.type === 'RESERVATION_CREATED') {
          window.dispatchEvent(new CustomEvent('RESERVATION_CREATED'));
        }

        // Show small toast
        setToastMessage(payload.notification?.title || 'Nueva notificación');
        setTimeout(() => setToastMessage(null), 4000);
      });
      return () => unsubscribe();
    }
  }, [permission]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayRole = () => {
    if (!user) return 'PERSONAL';
    if (user.roles?.includes('ADMIN')) return 'ADMINISTRADOR';
    if (user.roles?.includes('ENCARGADO')) return `ENCARGADO - SUCURSAL ${user.branchId || ''}`;
    if (user.roles?.includes('CAJERO')) return `CAJERO - SUCURSAL ${user.branchId || ''}`;
    return 'PERSONAL';
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="dashboard-header" style={{ position: 'relative' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          backgroundColor: '#1c2a28', color: '#fff', padding: '12px 20px',
          borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'fadeInOut 4s ease-in-out'
        }}>
          <strong>ATEMPORAL:</strong> {toastMessage}
        </div>
      )}

      <h2> </h2>
      <div className="header-actions">
        
        {/* Notification Bell */}
        <div className="notification-wrapper" ref={dropdownRef}>
          <button 
            className="notification-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Bell size={22} color="var(--atemporal-green)" />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
          
          {showDropdown && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h3>Notificaciones</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllAsRead} className="btn-mark-all">Marcar todas como leídas</button>
                )}
              </div>
              
              {isSupported && permission === 'default' && (
                <div style={{ padding: '10px 15px', backgroundColor: '#f0f8ff', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 8px 0' }}>Activa las notificaciones de escritorio para no perder ninguna reserva.</p>
                  <button 
                    onClick={requestPermissionAndRegister}
                    style={{ backgroundColor: '#1c2a28', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Habilitar notificaciones
                  </button>
                </div>
              )}

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="notification-empty">No tienes notificaciones</div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`notification-item ${!notif.read ? 'unread' : ''}`}
                      onClick={() => {
                        if (!notif.read) handleMarkAsRead(notif.id);
                        if (notif.reservationId) navigate('/dashboard/reservations'); // or specific detail
                      }}
                    >
                      <div className="notification-title">{notif.title}</div>
                      <div className="notification-msg">{notif.message}</div>
                      <div className="notification-time">{new Date(notif.createdAt).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="user-profile">
          <div className="user-info">
            <span className="user-name">{user?.name || 'Usuario'}</span>
            <span className="user-role-badge">{getDisplayRole()}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
