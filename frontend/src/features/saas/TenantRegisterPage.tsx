import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/axios';

interface Plan {
  id: number;
  code: string;
  name: string;
  priceMonthly: number;
  maxBranches: number;
  aiGenerativeReports: boolean;
}

type Step = 'form' | 'payment' | 'success';

const slugify = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export const TenantRegisterPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const plan: Plan | null = (location.state as any)?.plan ?? null;

  const [step, setStep] = useState<Step>('form');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Business form
  const [bizName, setBizName] = useState('');
  const [slug, setSlug] = useState('');
  const [taxId, setTaxId] = useState('');

  // Card form (simulated Stripe)
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  // Success data
  const [tenantResult, setTenantResult] = useState<any>(null);

  useEffect(() => {
    if (!plan) navigate('/pricing');
  }, [plan, navigate]);

  useEffect(() => {
    setSlug(slugify(bizName));
  }, [bizName]);

  if (!plan) return null;

  const isFree = plan.priceMonthly === 0;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !slug.trim()) return;
    if (isFree) {
      doRegister();
    } else {
      setStep('payment');
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 16 || expiry.length < 5 || cvc.length < 3 || !cardName.trim()) {
      setError('Complete todos los datos de la tarjeta.');
      return;
    }
    setError('');
    doRegister();
  };

  const doRegister = async () => {
    setProcessing(true);
    setError('');
    try {
      if (!isFree) {
        // Simular procesamiento de pago Stripe (1.5s)
        await new Promise(r => setTimeout(r, 1500));
      }
      const { data } = await api.post('/saas/tenants/register', {
        name: bizName.trim(),
        slug: slug.trim(),
        taxId: taxId.trim() || undefined,
        planCode: plan.code,
      });
      setTenantResult(data);
      setStep('success');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'No se pudo crear la empresa. Verifica que el slug no esté en uso.');
    } finally {
      setProcessing(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Empresa creada!</h2>
          {!isFree && (
            <p className="text-green-600 text-sm font-medium mb-4">Pago procesado correctamente</p>
          )}
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Empresa</span>
              <p className="font-semibold text-gray-900">{tenantResult?.name ?? bizName}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Slug / Identificador</span>
              <p className="font-mono text-sm text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">
                {tenantResult?.slug ?? slug}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Plan contratado</span>
              <p className="font-semibold text-gray-900">{plan.name}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Guarda tu identificador de empresa. Lo necesitarás para acceder al panel de administración.
          </p>
          <Link
            to="/login"
            className="block w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Ir al inicio de sesión
          </Link>
          <Link to="/pricing" className="block mt-3 text-sm text-gray-500 hover:text-gray-700">
            ← Ver otros planes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6">

        {/* Plan summary */}
        <div className="bg-[#1a1a1a] text-white rounded-2xl p-8 flex flex-col justify-between">
          <div>
            <Link to="/pricing" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-8">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Cambiar plan
            </Link>
            <div className="mb-6">
              <span className="text-xs text-amber-400 uppercase tracking-widest font-semibold">Plan seleccionado</span>
              <h2 className="text-3xl font-bold mt-1">{plan.name}</h2>
            </div>
            <div className="mb-8">
              {plan.priceMonthly === 0 ? (
                <span className="text-5xl font-black">Gratis</span>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-lg text-gray-400">$</span>
                  <span className="text-5xl font-black">{plan.priceMonthly}</span>
                  <span className="text-gray-400">/mes</span>
                </div>
              )}
            </div>
            <ul className="space-y-3">
              {[
                `${plan.maxBranches === 99 ? 'Ilimitadas' : plan.maxBranches} sucursal${plan.maxBranches !== 1 ? 'es' : ''}`,
                plan.aiGenerativeReports ? 'Reportes con IA generativa' : 'Reportes básicos',
                'Operaciones offline incluidas',
                'Punto de venta (POS)',
                'Gestión de inventario',
              ].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                  <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-500 mt-8">
            Sin compromisos. Cancela en cualquier momento.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-md p-8">
          {step === 'form' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Datos de tu empresa</h2>
              <p className="text-sm text-gray-500 mb-6">
                {isFree ? 'Completa los datos para comenzar gratis.' : 'Completa los datos antes del pago.'}
              </p>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa *</label>
                  <input
                    value={bizName}
                    onChange={e => setBizName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Ej: Moda Elegante S.R.L."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Identificador único (slug) *</label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-500">
                    <span className="bg-gray-50 px-3 py-2.5 text-sm text-gray-400 border-r border-gray-300 select-none">
                      fashionstore.io/
                    </span>
                    <input
                      value={slug}
                      onChange={e => setSlug(slugify(e.target.value))}
                      className="flex-1 px-3 py-2.5 text-sm focus:outline-none font-mono"
                      placeholder="mi-empresa"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Solo minúsculas, números y guiones.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT / RUC (opcional)</label>
                  <input
                    value={taxId}
                    onChange={e => setTaxId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Número de registro tributario"
                  />
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={processing || !bizName.trim() || !slug.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-2"
                >
                  {isFree ? (processing ? 'Creando empresa…' : 'Crear empresa gratis') : 'Continuar al pago →'}
                </button>
              </form>
            </>
          )}

          {step === 'payment' && (
            <>
              {/* Simulated Stripe header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Datos de pago</h2>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Pago seguro via Stripe
                </div>
              </div>

              {/* Stripe-like card preview */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 mb-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
                <div className="relative">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-7 bg-amber-400 rounded-sm opacity-90" />
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Crédito</span>
                  </div>
                  <p className="font-mono text-lg tracking-widest mb-4">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Titular</p>
                      <p className="text-sm font-medium">{cardName || 'NOMBRE APELLIDO'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Vence</p>
                      <p className="text-sm font-medium">{expiry || 'MM/AA'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de tarjeta</label>
                  <div className="relative">
                    <input
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCard(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                      <div className="w-6 h-4 bg-red-500 rounded-sm opacity-80" />
                      <div className="w-6 h-4 bg-yellow-400 rounded-sm opacity-80 -ml-2" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre en la tarjeta</label>
                  <input
                    value={cardName}
                    onChange={e => setCardName(e.target.value.toUpperCase())}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="NOMBRE APELLIDO"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
                    <input
                      value={expiry}
                      onChange={e => setExpiry(formatExpiry(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="MM/AA"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                    <input
                      value={cvc}
                      onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="123"
                      maxLength={3}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700">
                    Usa <strong>4242 4242 4242 4242</strong>, cualquier fecha futura y cualquier CVC para simular un pago aprobado.
                  </p>
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Procesando pago…
                    </>
                  ) : (
                    `Pagar $${plan.priceMonthly}/mes y activar empresa`
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('form'); setError(''); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
                >
                  ← Volver a datos de empresa
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
