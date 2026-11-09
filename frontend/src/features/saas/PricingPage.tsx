import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const PLAN_FEATURES: Record<string, { description: string; features: string[]; badge?: string; color: string }> = {
  BASICO: {
    description: 'Perfecto para empezar tu negocio digital.',
    badge: undefined,
    color: 'border-gray-200',
    features: [
      '1 sucursal',
      'Hasta 50 productos',
      'Punto de venta (POS)',
      'Catálogo en línea',
      'Reservas de clientes',
      'Operaciones offline',
    ],
  },
  STARTER: {
    description: 'Para negocios en crecimiento con múltiples puntos.',
    badge: undefined,
    color: 'border-gray-200',
    features: [
      '3 sucursales',
      'Productos ilimitados',
      'POS con sesiones de caja',
      'Inventario multisucursal',
      'Sincronización offline',
      'Reportes básicos',
    ],
  },
  PROFESIONAL: {
    description: 'La solución completa para empresas establecidas.',
    badge: 'Más popular',
    color: 'border-amber-500',
    features: [
      '10 sucursales',
      'Todo lo de Starter',
      'Reportes con IA generativa',
      'Análisis de demanda (ML)',
      'Segmentación RFM de clientes',
      'Soporte prioritario',
    ],
  },
  EMPRESARIAL: {
    description: 'Escala sin límites con soporte dedicado.',
    badge: undefined,
    color: 'border-gray-200',
    features: [
      'Sucursales ilimitadas',
      'Todo lo de Profesional',
      'SLA 99.9% uptime',
      'Onboarding personalizado',
      'API dedicada',
      'Soporte 24/7',
    ],
  },
};

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

  const handleSelect = (plan: Plan) => {
    navigate('/saas/register', { state: { plan } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-[#1a1a1a] text-white py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
            SaaS FashionStore
          </span>
          <h1 className="text-4xl font-bold mb-4">Elige el plan perfecto para tu negocio</h1>
          <p className="text-gray-400 text-lg">
            Comienza gratis. Escala cuando lo necesites. Sin permanencia.
          </p>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const meta = PLAN_FEATURES[plan.code] ?? {
                description: '', features: [], color: 'border-gray-200',
              };
              const isPopular = !!meta.badge;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl border-2 ${meta.color} ${isPopular ? 'shadow-xl scale-105' : 'shadow-md'} p-6 flex flex-col`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                        {meta.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
                  </div>

                  <div className="mb-6">
                    {plan.priceMonthly === 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-gray-900">Gratis</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-gray-500">$</span>
                        <span className="text-4xl font-black text-gray-900">{plan.priceMonthly}</span>
                        <span className="text-sm text-gray-500">/mes</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-2 mb-8 flex-1">
                    {meta.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelect(plan)}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                      isPopular
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                        : 'bg-gray-900 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {plan.priceMonthly === 0 ? 'Comenzar gratis' : `Contratar por $${plan.priceMonthly}/mes`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Comparison note */}
        <div className="mt-16 text-center text-sm text-gray-500">
          <p>Todos los planes incluyen operaciones offline, múltiples usuarios y actualizaciones automáticas.</p>
          <p className="mt-1">¿Dudas? <a href="mailto:soporte@fashionstore.io" className="text-amber-600 hover:underline">Contacta a soporte</a>.</p>
        </div>
      </div>
    </div>
  );
};
