import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';

interface Plan {
  id: number;
  code: string;
  name: string;
  priceMonthly: number;
  maxBranches: number;
  aiGenerativeReports: boolean;
  offlineOperations: boolean;
}

const PLAN_META: Record<string, { description: string; features: string[]; badge?: string; accent: boolean }> = {
  BASICO: {
    description: 'Perfecto para empezar tu negocio digital sin costo.',
    accent: false,
    features: ['1 sucursal', 'Hasta 50 productos', 'Punto de venta (POS)', 'Catálogo en línea', 'Reservas de clientes', 'Operaciones offline básicas'],
  },
  STARTER: {
    description: 'Para negocios en crecimiento con múltiples puntos de venta.',
    accent: false,
    features: ['3 sucursales', 'Productos ilimitados', 'POS con sesiones de caja', 'Inventario multisucursal', 'Sincronización offline', 'Reportes básicos'],
  },
  PROFESIONAL: {
    description: 'La solución completa para empresas establecidas.',
    badge: 'Más popular',
    accent: true,
    features: ['10 sucursales', 'Todo lo del plan Starter', 'Reportes con IA generativa', 'Análisis de demanda (ML)', 'Segmentación RFM de clientes', 'Soporte prioritario'],
  },
  EMPRESARIAL: {
    description: 'Escala sin límites. Soporte dedicado 24/7.',
    accent: false,
    features: ['Sucursales ilimitadas', 'Todo lo del plan Profesional', 'SLA 99.9% uptime', 'Onboarding personalizado', 'API dedicada', 'Soporte 24/7'],
  },
};

const Check = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export const PricingPage = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/saas/plans')
      .then(r => setPlans(r.data))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--atemporal-cream, #F5F2EB)', fontFamily: "'Outfit', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav style={{ background: 'var(--atemporal-green, #182D2A)', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ color: 'var(--atemporal-cream, #F5F2EB)', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem', letterSpacing: 2 }}>
          ATEMPORAL
        </Link>
        <Link to="/login" style={{ color: 'var(--atemporal-beige, #CFC1A5)', textDecoration: 'none', fontSize: '0.85rem' }}>
          Ya tengo cuenta →
        </Link>
      </nav>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--atemporal-green, #182D2A) 0%, #0d1f1d 100%)',
        padding: '64px 24px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <span style={{
          display: 'inline-block',
          background: 'rgba(201,144,74,0.2)',
          color: 'var(--atemporal-gold, #C9904A)',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '5px 16px',
          borderRadius: 20,
          marginBottom: 20,
          border: '1px solid rgba(201,144,74,0.3)',
        }}>
          SaaS FashionStore
        </span>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.2 }}>
          Elige el plan perfecto<br />para tu negocio
        </h1>
        <p style={{ color: '#94a3a0', fontSize: '1.05rem', margin: 0 }}>
          Comienza gratis. Escala cuando lo necesites. Sin permanencia mínima.
        </p>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #e5e7eb',
              borderTopColor: 'var(--atemporal-gold, #C9904A)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}>
            {plans.map((plan) => {
              const meta = PLAN_META[plan.code] ?? { description: '', features: [], accent: false };
              return (
                <div key={plan.id} style={{
                  position: 'relative',
                  background: meta.accent ? 'var(--atemporal-green, #182D2A)' : '#fff',
                  color: meta.accent ? '#fff' : 'var(--atemporal-text, #1D2926)',
                  borderRadius: 20,
                  padding: meta.accent ? '36px 28px 28px' : '28px',
                  boxShadow: meta.accent
                    ? '0 20px 60px rgba(24,45,42,0.35)'
                    : '0 2px 20px rgba(0,0,0,0.07)',
                  border: meta.accent ? 'none' : '1.5px solid #e8e3d9',
                  transform: meta.accent ? 'translateY(-8px)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}>
                  {meta.badge && (
                    <div style={{
                      position: 'absolute',
                      top: -13,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--atemporal-gold, #C9904A)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '5px 18px',
                      borderRadius: 20,
                      whiteSpace: 'nowrap',
                    }}>
                      {meta.badge}
                    </div>
                  )}

                  {/* Plan name */}
                  <div style={{ marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{plan.name}</h3>
                    <p style={{ margin: '6px 0 0', fontSize: '0.82rem', opacity: 0.65, lineHeight: 1.4 }}>{meta.description}</p>
                  </div>

                  {/* Price */}
                  <div style={{ margin: '20px 0 24px' }}>
                    {plan.priceMonthly === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1 }}>Gratis</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: '1rem', opacity: 0.6, alignSelf: 'flex-start', marginTop: 6 }}>$</span>
                        <span style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1 }}>{plan.priceMonthly}</span>
                        <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>/mes</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {meta.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                        <span style={{ color: meta.accent ? 'var(--atemporal-gold, #C9904A)' : '#22c55e' }}>
                          <Check />
                        </span>
                        <span style={{ opacity: 0.85 }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => navigate('/saas/register', { state: { plan } })}
                    style={{
                      width: '100%',
                      padding: '13px 0',
                      border: 'none',
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      letterSpacing: '0.02em',
                      transition: 'all 0.2s',
                      background: meta.accent
                        ? 'var(--atemporal-gold, #C9904A)'
                        : 'var(--atemporal-green, #182D2A)',
                      color: '#fff',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                  >
                    {plan.priceMonthly === 0 ? 'Comenzar gratis' : `Contratar — $${plan.priceMonthly}/mes`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 48, fontSize: '0.85rem', color: '#6b7280' }}>
          Todos los planes incluyen operaciones offline, múltiples usuarios y actualizaciones automáticas.{' '}
          <a href="mailto:soporte@fashionstore.io" style={{ color: 'var(--atemporal-gold, #C9904A)' }}>
            ¿Dudas? Contacta soporte.
          </a>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
