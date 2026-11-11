import { Link } from 'react-router-dom';
import { usePlan } from '../../features/saas/PlanContext';
import { useAuth } from '../../features/auth/AuthContext';

/** Aviso cuando la suscripción está vencida o por vencer (7 días). Solo para el administrador. */
export const SubscriptionBanner = () => {
  const { tenant } = usePlan();
  const { user } = useAuth();
  const sub = (tenant as any)?.subscription;
  if (!sub || !user?.roles?.includes('ADMIN')) return null;
  const expired = sub.status === 'EXPIRED';
  const soon = sub.status === 'ACTIVE' && sub.daysLeft != null && sub.daysLeft <= 7;
  if (!expired && !soon) return null;
  return (
    <div style={{ margin: '12px 0 0', padding: '10px 14px', borderRadius: 10, fontSize: '0.86rem', background: expired ? '#fee2e2' : '#fef3c7', color: expired ? '#991b1b' : '#92400e', display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <span>{expired ? 'Tu suscripción venció: no podrás crear sucursales, productos ni usuarios ni usar las funciones del plan.' : `Tu suscripción vence en ${sub.daysLeft} día${sub.daysLeft === 1 ? '' : 's'}.`}</span>
      <Link to="/dashboard/subscription" style={{ fontWeight: 700, color: 'inherit' }}>Renovar →</Link>
    </div>
  );
};
