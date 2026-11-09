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

const formatCard = (v: string) =>
  v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const InputField = ({
  label, value, onChange, placeholder, hint, type = 'text', maxLength, prefix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; type?: string; maxLength?: number; prefix?: string;
}) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
      {label}
    </label>
    <div style={{ display: 'flex', border: '1.5px solid #d1d5db', borderRadius: 10, overflow: 'hidden', background: '#fff', transition: 'border-color 0.2s' }}
      onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--atemporal-gold, #C9904A)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px rgba(201,144,74,0.12)'; }}
      onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {prefix && (
        <span style={{ padding: '10px 12px', background: '#f9fafb', color: '#9ca3af', fontSize: '0.82rem', borderRight: '1.5px solid #d1d5db', whiteSpace: 'nowrap', userSelect: 'none' }}>
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{
          flex: 1, border: 'none', outline: 'none', padding: '11px 14px',
          fontSize: '0.9rem', background: 'transparent', fontFamily: 'inherit',
          fontFamily: type === 'tel' ? 'monospace' : 'inherit',
        } as React.CSSProperties}
      />
    </div>
    {hint && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>{hint}</p>}
  </div>
);

const CheckIcon = ({ color = '#22c55e' }: { color?: string }) => (
  <svg width="15" height="15" fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

export const TenantRegisterPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const plan: Plan | null = (location.state as any)?.plan ?? null;

  const [step, setStep] = useState<Step>('form');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const [bizName, setBizName] = useState('');
  const [slug, setSlug] = useState('');
  const [taxId, setTaxId] = useState('');

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const [tenantResult, setTenantResult] = useState<any>(null);

  useEffect(() => { if (!plan) navigate('/pricing'); }, [plan, navigate]);
  useEffect(() => { setSlug(slugify(bizName)); }, [bizName]);

  if (!plan) return null;
  const isFree = plan.priceMonthly === 0;

  const doRegister = async () => {
    setProcessing(true);
    setError('');
    try {
      if (!isFree) await new Promise(r => setTimeout(r, 1800));
      const { data } = await api.post('/saas/tenants/register', {
        name: bizName.trim(), slug: slug.trim(),
        taxId: taxId.trim() || undefined, planCode: plan.code,
      });
      setTenantResult(data);
      setStep('success');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'No se pudo crear la empresa. Verifica que el slug no esté en uso.');
    } finally {
      setProcessing(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !slug.trim()) return;
    if (isFree) doRegister(); else setStep('payment');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.replace(/\s/g, '').length < 16 || expiry.length < 5 || cvc.length < 3 || !cardHolder.trim()) {
      setError('Complete todos los datos de la tarjeta.');
      return;
    }
    setError('');
    doRegister();
  };

  /* ── Shared layout ── */
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--atemporal-cream, #F5F2EB)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Outfit', system-ui, sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 4px 40px rgba(0,0,0,0.10)',
    overflow: 'hidden',
  };

  /* ── SUCCESS ── */
  if (step === 'success') {
    return (
      <div style={pageStyle}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ ...cardStyle, maxWidth: 460, width: '100%', padding: 48, textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d1fae5, #bbf7d0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="32" height="32" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 8px', color: 'var(--atemporal-text, #1D2926)' }}>
              ¡Empresa creada!
            </h2>
            {!isFree && (
              <p style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 20px' }}>
                ✓ Pago de ${plan.priceMonthly}/mes procesado correctamente
              </p>
            )}

            <div style={{
              background: 'var(--atemporal-cream, #F5F2EB)',
              borderRadius: 14,
              padding: '20px 24px',
              textAlign: 'left',
              marginBottom: 28,
              border: '1px solid #e8e3d9',
            }}>
              {[
                { label: 'Empresa', value: tenantResult?.name ?? bizName },
                { label: 'Plan contratado', value: plan.name },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', fontWeight: 600 }}>{label}</span>
                  <p style={{ margin: '3px 0 0', fontWeight: 600, color: 'var(--atemporal-text, #1D2926)' }}>{value}</p>
                </div>
              ))}
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', fontWeight: 600 }}>Identificador (slug)</span>
                <p style={{ margin: '5px 0 0', fontFamily: 'monospace', fontSize: '0.95rem', background: '#fff', border: '1px solid #e8e3d9', padding: '7px 12px', borderRadius: 8, color: 'var(--atemporal-gold, #C9904A)', fontWeight: 700 }}>
                  {tenantResult?.slug ?? slug}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 24 }}>
              Guarda tu identificador. Lo usarás para personalizar tu portal de tienda.
            </p>

            <Link to="/login" style={{
              display: 'block', background: 'var(--atemporal-green, #182D2A)',
              color: '#fff', textDecoration: 'none', fontWeight: 700,
              padding: '14px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.9rem',
            }}>
              Ir al inicio de sesión →
            </Link>
            <Link to="/pricing" style={{ display: 'block', marginTop: 14, fontSize: '0.82rem', color: '#9ca3af', textDecoration: 'none' }}>
              ← Ver otros planes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── MAIN LAYOUT ── */
  return (
    <div style={pageStyle}>

      {/* Top nav */}
      <nav style={{ background: 'var(--atemporal-green, #182D2A)', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/pricing" style={{ color: 'var(--atemporal-beige, #CFC1A5)', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Ver planes
        </Link>
        <span style={{ color: 'var(--atemporal-cream, #F5F2EB)', fontWeight: 700, letterSpacing: 2, fontSize: '1rem' }}>ATEMPORAL</span>
        <div style={{ width: 80 }} />
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 28, maxWidth: 860, width: '100%' }}>

          {/* ── LEFT: Plan summary ── */}
          <div style={{
            background: 'linear-gradient(160deg, var(--atemporal-green, #182D2A) 0%, #0d1f1d 100%)',
            borderRadius: 20, padding: 36, color: '#fff', display: 'flex', flexDirection: 'column',
          }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--atemporal-gold, #C9904A)', fontWeight: 700 }}>
              Plan seleccionado
            </span>
            <h2 style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: 800 }}>{plan.name}</h2>

            <div style={{ margin: '24px 0 32px' }}>
              {isFree ? (
                <span style={{ fontSize: '2.8rem', fontWeight: 900 }}>Gratis</span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: '1rem', opacity: 0.6, alignSelf: 'flex-start', marginTop: 10 }}>$</span>
                  <span style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>{plan.priceMonthly}</span>
                  <span style={{ opacity: 0.6 }}>/mes</span>
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 16px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, fontWeight: 600 }}>Incluye</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  `${plan.maxBranches === 99 ? 'Ilimitadas' : plan.maxBranches} sucursal${plan.maxBranches !== 1 ? 'es' : ''}`,
                  plan.aiGenerativeReports ? 'Reportes con IA generativa' : 'Reportes básicos',
                  'Operaciones offline incluidas',
                  'Punto de venta (POS)',
                  'Gestión de inventario multisucursal',
                ].map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', color: 'rgba(255,255,255,0.8)' }}>
                    <CheckIcon color="var(--atemporal-gold, #C9904A)" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 32, padding: '14px 16px', background: 'rgba(255,255,255,0.06)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Sin compromisos. Cancela en cualquier momento desde tu panel de administración.
              </p>
            </div>
          </div>

          {/* ── RIGHT: Form ── */}
          <div style={{ ...cardStyle, padding: '36px 32px' }}>

            {/* STEP: Business form */}
            {step === 'form' && (
              <>
                <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem', fontWeight: 800, color: 'var(--atemporal-text, #1D2926)' }}>
                  Datos de tu empresa
                </h2>
                <p style={{ margin: '0 0 28px', fontSize: '0.85rem', color: '#6b7280' }}>
                  {isFree ? 'Completa los datos para comenzar gratis de inmediato.' : 'Completa los datos antes de continuar al pago.'}
                </p>

                <form onSubmit={handleFormSubmit}>
                  <InputField
                    label="Nombre de la empresa *"
                    value={bizName}
                    onChange={setBizName}
                    placeholder="Ej: Moda Elegante S.R.L."
                  />

                  <InputField
                    label="Identificador único (slug) *"
                    value={slug}
                    onChange={v => setSlug(slugify(v))}
                    placeholder="mi-empresa"
                    hint="Solo minúsculas, números y guiones. Será tu URL personalizada."
                    prefix="fashionstore.io/"
                  />

                  <InputField
                    label="NIT / Número tributario (opcional)"
                    value={taxId}
                    onChange={setTaxId}
                    placeholder="Número de registro"
                  />

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
                      <p style={{ margin: 0, fontSize: '0.83rem', color: '#dc2626' }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={processing || !bizName.trim() || !slug.trim()}
                    style={{
                      width: '100%', padding: '14px 0', border: 'none', borderRadius: 12, cursor: 'pointer',
                      background: 'var(--atemporal-gold, #C9904A)', color: '#fff',
                      fontWeight: 700, fontSize: '0.95rem', marginTop: 8, opacity: processing || !bizName.trim() || !slug.trim() ? 0.5 : 1,
                      transition: 'opacity 0.2s', letterSpacing: '0.02em',
                    }}
                  >
                    {isFree
                      ? (processing ? 'Creando empresa…' : 'Crear empresa gratis →')
                      : 'Continuar al pago →'
                    }
                  </button>
                </form>
              </>
            )}

            {/* STEP: Payment */}
            {step === 'payment' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--atemporal-text, #1D2926)' }}>
                    Datos de pago
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#6b7280' }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    Pago seguro · Stripe
                  </div>
                </div>

                {/* Card preview */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  borderRadius: 16, padding: 24, marginBottom: 24, color: '#fff',
                  position: 'relative', overflow: 'hidden', minHeight: 160,
                }}>
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', bottom: -40, left: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                      <div style={{ width: 42, height: 28, background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: 5 }} />
                      <div style={{ display: 'flex', gap: -6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ef4444', opacity: 0.9 }} />
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', opacity: 0.9, marginLeft: -10 }} />
                      </div>
                    </div>
                    <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.15em', opacity: 0.9 }}>
                      {cardNumber || '•••• •••• •••• ••••'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Titular</p>
                        <p style={{ margin: '3px 0 0', fontSize: '0.85rem', fontWeight: 500 }}>{cardHolder || 'NOMBRE APELLIDO'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Vence</p>
                        <p style={{ margin: '3px 0 0', fontSize: '0.85rem', fontFamily: 'monospace' }}>{expiry || 'MM/AA'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePaymentSubmit}>
                  <InputField
                    label="Número de tarjeta"
                    value={cardNumber}
                    onChange={v => setCardNumber(formatCard(v))}
                    placeholder="1234 5678 9012 3456"
                    type="tel"
                    maxLength={19}
                  />
                  <InputField
                    label="Nombre del titular"
                    value={cardHolder}
                    onChange={v => setCardHolder(v.toUpperCase())}
                    placeholder="NOMBRE APELLIDO"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <InputField
                        label="Vencimiento"
                        value={expiry}
                        onChange={v => setExpiry(formatExpiry(v))}
                        placeholder="MM/AA"
                        type="tel"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <InputField
                        label="CVC"
                        value={cvc}
                        onChange={v => setCvc(v.replace(/\D/g, '').slice(0, 3))}
                        placeholder="123"
                        type="tel"
                        maxLength={3}
                      />
                    </div>
                  </div>

                  {/* Stripe test hint */}
                  <div style={{
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <svg width="15" height="15" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#1d4ed8', lineHeight: 1.5 }}>
                      Tarjeta de prueba: <strong>4242 4242 4242 4242</strong>, cualquier fecha futura y cualquier CVC de 3 dígitos.
                    </p>
                  </div>

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                      <p style={{ margin: 0, fontSize: '0.83rem', color: '#dc2626' }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={processing}
                    style={{
                      width: '100%', padding: '14px 0', border: 'none', borderRadius: 12, cursor: 'pointer',
                      background: processing ? '#d1d5db' : 'var(--atemporal-green, #182D2A)',
                      color: '#fff', fontWeight: 700, fontSize: '0.92rem', letterSpacing: '0.02em',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      transition: 'background 0.2s',
                    }}
                  >
                    {processing ? (
                      <>
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                          <path fill="rgba(255,255,255,0.9)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.83rem', marginTop: 12, padding: '8px 0' }}
                  >
                    ← Volver a datos de empresa
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
