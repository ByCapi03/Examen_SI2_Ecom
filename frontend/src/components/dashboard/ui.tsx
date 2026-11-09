import { useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { usePlan } from '../../features/saas/PlanContext';
import type { PlanGateFeature } from '../../features/saas/PlanContext';

export const SERIES = ['var(--chart-1, #182D2A)', 'var(--chart-2, #C9904A)', 'var(--chart-3, #5E7C76)', 'var(--chart-4, #9DB0AC)', 'var(--chart-5, #E0BE93)', 'var(--chart-6, #CFC1A5)'];
const TRACK = 'var(--chart-track, #EEEAE1)';

export const DashStyles = () => (
  <style>{`
    .dz-page { padding: 24px 0 40px; color: var(--atemporal-text); }
    .dz-grid { display: grid; gap: 18px; }
    .dz-kpis { grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); }
    .dz-2-1 { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
    .dz-1-1 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); }
    .dz-1-1-1 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
    .dz-card { background: var(--atemporal-white); border: 1px solid var(--atemporal-border); border-radius: 16px; padding: 20px; box-shadow: 0 1px 2px rgba(16,36,33,0.04), 0 6px 22px rgba(16,36,33,0.05); min-width: 0; }
    .dz-card h3 { margin: 0; font-size: 0.98rem; font-weight: 700; color: var(--atemporal-text); }
    .dz-sub { margin: 2px 0 0; font-size: 0.78rem; color: var(--atemporal-muted); }
    .dz-input { padding: 8px 11px; border-radius: 9px; border: 1.5px solid var(--atemporal-border); background: var(--atemporal-white); color: var(--atemporal-text); font-family: inherit; font-size: 0.85rem; outline: none; min-width: 0; }
    .dz-input:focus { border-color: var(--atemporal-gold); }
    .dz-btn { padding: 9px 16px; border-radius: 9px; border: none; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 0.84rem; background: var(--atemporal-green); color: #fff; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
    .dz-btn.ghost { background: transparent; color: var(--atemporal-text); border: 1.5px solid var(--atemporal-border); }
    .dz-btn.gold { background: var(--atemporal-gold); }
    .dz-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .dz-table th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--atemporal-muted); font-weight: 700; padding: 9px 10px; border-bottom: 1px solid var(--atemporal-border); white-space: nowrap; }
    .dz-table td { padding: 10px; border-bottom: 1px solid var(--atemporal-border); white-space: nowrap; }
    .dz-table tr:last-child td { border-bottom: none; }
    .dz-table .r { text-align: right; font-variant-numeric: tabular-nums; }
    .dz-table .c { text-align: center; }
    .dz-scroll { overflow-x: auto; }
    .dz-tabs { display: inline-flex; gap: 4px; padding: 4px; background: var(--atemporal-white); border: 1px solid var(--atemporal-border); border-radius: 12px; flex-wrap: wrap; }
    .dz-tab { border: none; background: transparent; padding: 8px 15px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--atemporal-muted); display: inline-flex; align-items: center; gap: 7px; }
    .dz-tab.on { background: var(--atemporal-green); color: #fff; }
    .dz-skel { background: linear-gradient(90deg, var(--chart-track, #eee) 25%, transparent 50%, var(--chart-track, #eee) 75%); background-size: 200% 100%; animation: dzsk 1.3s infinite; border-radius: 10px; }
    @keyframes dzsk { to { background-position: -200% 0; } }
    @media (max-width: 1000px) { .dz-2-1 { grid-template-columns: 1fr; } }
  `}</style>
);

export const PageHeader = ({ title, subtitle, badge, actions }: { title: string; subtitle?: string; badge?: ReactNode; actions?: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: 'var(--atemporal-text)' }}>{title}</h1>
        {badge}
      </div>
      {subtitle && <p style={{ margin: '4px 0 0', color: 'var(--atemporal-muted)', fontSize: '0.88rem' }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
  </div>
);

export const PlanBadge = () => {
  const { tenant } = usePlan();
  if (!tenant?.plan) return null;
  const premium = tenant.plan.aiGenerativeReports;
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: 999,
      background: premium ? 'var(--atemporal-gold)' : 'var(--atemporal-green)', color: '#fff',
    }}>
      {tenant.plan.name}
    </span>
  );
};

export const Card = ({ title, subtitle, actions, children, style }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; style?: CSSProperties }) => (
  <section className="dz-card" style={style}>
    {(title || actions) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          {title && <h3>{title}</h3>}
          {subtitle && <p className="dz-sub">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);

export const Empty = ({ text }: { text: string }) => (
  <div style={{ padding: '28px 10px', textAlign: 'center', color: 'var(--atemporal-muted)', fontSize: '0.85rem' }}>{text}</div>
);

export const Skeleton = ({ h = 120 }: { h?: number }) => <div className="dz-skel" style={{ height: h }} />;

/* ── KPI ── */
export const KpiCard = ({ label, value, icon, delta, spark, tone = 'primary' }: {
  label: string; value: string; icon?: ReactNode; delta?: number | null; spark?: number[]; tone?: 'primary' | 'accent' | 'danger';
}) => {
  const color = tone === 'danger' ? '#C2410C' : tone === 'accent' ? 'var(--atemporal-gold)' : 'var(--chart-1, #182D2A)';
  return (
    <div className="dz-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--atemporal-muted)', lineHeight: 1.3 }}>{label}</span>
        {icon && <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--chart-track, #EEEAE1)', color }}>{icon}</span>}
      </div>
      <div title={value} style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.1, color: 'var(--atemporal-text)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {((delta !== undefined && delta !== null) || (spark && spark.length > 1)) && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, minHeight: 26, flexWrap: 'wrap' }}>
          {delta !== undefined && delta !== null ? <Delta value={delta} /> : <span />}
          {spark && spark.length > 1 && <MiniSpark values={spark} color={color} />}
        </div>
      )}
    </div>
  );
};

export const Delta = ({ value }: { value: number }) => {
  const up = value > 0.5, down = value < -0.5;
  const c = up ? '#15803D' : down ? '#B91C1C' : 'var(--atemporal-muted)';
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 700, color: c, marginTop: 4 }}>
      <Icon size={13} /> {value > 0 ? '+' : ''}{value.toFixed(1)}% <span style={{ color: 'var(--atemporal-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>vs ayer</span>
    </span>
  );
};

const MiniSpark = ({ values, color }: { values: number[]; color: string }) => {
  const w = 72, h = 26, max = Math.max(...values, 1);
  const x = (i: number) => (i * w) / (values.length - 1);
  const y = (v: number) => h - 2 - (v / max) * (h - 4);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <path d={`${d} L${w},${h} L0,${h} Z`} style={{ fill: color, opacity: 0.12 }} />
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

/* ── Gráfico de área ── */
export const AreaChart = ({ points, format, height = 240 }: { points: { label: string; value: number }[]; format: (v: number) => string; height?: number }) => {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <Empty text="Sin datos" />;
  const w = 640, padL = 54, padR = 14, padT = 14, padB = 30;
  const max = Math.max(...points.map((p) => p.value), 1) * 1.1;
  const x = (i: number) => padL + (points.length === 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (points.length - 1));
  const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${height - padB} L${x(0)},${height - padB} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  const step = Math.ceil(points.length / 10);
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--chart-1, #182D2A)', stopOpacity: 0.32 }} />
            <stop offset="100%" style={{ stopColor: 'var(--chart-1, #182D2A)', stopOpacity: 0.02 }} />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} style={{ stroke: TRACK }} strokeDasharray={i ? '3 4' : undefined} />
            <text x={padL - 8} y={y(t) + 4} fontSize="10" textAnchor="end" style={{ fill: 'var(--atemporal-muted)' }}>{format(t)}</text>
          </g>
        ))}
        <path d={area} fill={`url(#g${gid})`} />
        <path d={line} fill="none" style={{ stroke: 'var(--chart-1, #182D2A)' }} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <rect x={x(i) - (w / points.length) / 2} y={padT} width={w / points.length} height={height - padT - padB} fill="transparent" onMouseEnter={() => setHover(i)} />
            {hover === i && <line x1={x(i)} x2={x(i)} y1={padT} y2={height - padB} style={{ stroke: 'var(--atemporal-gold)' }} strokeDasharray="3 3" />}
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 3} style={{ fill: 'var(--atemporal-white)', stroke: 'var(--atemporal-gold)' }} strokeWidth="2" pointerEvents="none" />
            {(i % step === 0 || i === points.length - 1) && (
              <text x={x(i)} y={height - 10} fontSize="10" textAnchor="middle" style={{ fill: 'var(--atemporal-muted)' }}>{p.label}</text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div style={{
          position: 'absolute', top: 6, left: `${(x(hover) / w) * 100}%`, transform: 'translateX(-50%)',
          background: 'var(--atemporal-green)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: '0.75rem',
          pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}>
          <b>{points[hover].label}</b> · {format(points[hover].value)}
        </div>
      )}
    </div>
  );
};

/* ── Dona ── */
export const DonutChart = ({ slices, format, centerLabel }: { slices: { label: string; value: number }[]; format: (v: number) => string; centerLabel?: string }) => {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  if (!total) return <Empty text="Sin datos" />;
  const r = 62, c = 2 * Math.PI * r;
  const lens = slices.map((s) => (s.value / total) * c);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg viewBox="0 0 170 170" width={170} height={170} style={{ flexShrink: 0 }}>
        <circle cx="85" cy="85" r={r} fill="none" style={{ stroke: TRACK }} strokeWidth="22" />
        {slices.map((_s, i) => {
          const len = lens[i];
          return (
            <circle key={i} cx="85" cy="85" r={r} fill="none" style={{ stroke: SERIES[i % SERIES.length], transition: 'stroke-width .15s' }}
              strokeWidth={hover === i ? 27 : 22} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offsets[i]}
              transform="rotate(-90 85 85)" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          );
        })}
        <text x="85" y="80" textAnchor="middle" fontSize="11" style={{ fill: 'var(--atemporal-muted)' }}>{hover !== null ? slices[hover].label : centerLabel ?? 'Total'}</text>
        <text x="85" y="99" textAnchor="middle" fontSize="15" fontWeight="800" style={{ fill: 'var(--atemporal-text)' }}>{format(hover !== null ? slices[hover].value : total)}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 140, flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '0.82rem', opacity: hover === null || hover === i ? 1 : 0.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[i % SERIES.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--atemporal-text)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--atemporal-text)' }}>{((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Barras horizontales ── */
export const HBarChart = ({ rows, format, sub }: { rows: { label: string; value: number; sub?: string }[]; format: (v: number) => string; sub?: boolean }) => {
  if (!rows.length) return <Empty text="Sin datos" />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem', marginBottom: 5 }}>
            <span style={{ color: 'var(--atemporal-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>
              <span style={{ color: 'var(--atemporal-muted)', fontWeight: 700, marginRight: 6 }}>{i + 1}</span>{r.label}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--atemporal-text)', whiteSpace: 'nowrap' }}>
              {format(r.value)}{sub && r.sub && <span style={{ color: 'var(--atemporal-muted)', fontWeight: 500 }}> · {r.sub}</span>}
            </span>
          </div>
          <div style={{ height: 9, background: TRACK, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 6, background: i === 0 ? 'var(--atemporal-gold)' : 'var(--chart-1, #182D2A)', transition: 'width .4s' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Columnas verticales ── */
export const ColumnChart = ({ rows, format, height = 200 }: { rows: { label: string; value: number }[]; format: (v: number) => string; height?: number }) => {
  if (!rows.length) return <Empty text="Sin datos" />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, paddingTop: 22 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--atemporal-text)', marginBottom: 4, whiteSpace: 'nowrap' }}>{format(r.value)}</span>
          <div title={`${r.label}: ${format(r.value)}`} style={{ width: '100%', maxWidth: 54, height: `${Math.max((r.value / max) * 100, 2)}%`, background: SERIES[i % 4], borderRadius: '7px 7px 2px 2px', transition: 'height .4s' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--atemporal-muted)', marginTop: 6, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Barras apiladas (p. ej. disponible vs reservado) ── */
export const StackedBars = ({ rows, keys, format }: { rows: { label: string; values: number[] }[]; keys: string[]; format: (v: number) => string }) => {
  if (!rows.length) return <Empty text="Sin datos" />;
  const max = Math.max(...rows.map((r) => r.values.reduce((a, b) => a + b, 0)), 1);
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        {keys.map((k, i) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--atemporal-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[i] }} />{k}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((r) => {
          const total = r.values.reduce((a, b) => a + b, 0);
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
                <span style={{ fontWeight: 600, color: 'var(--atemporal-text)' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: 'var(--atemporal-text)' }}>{format(total)}</span>
              </div>
              <div style={{ display: 'flex', height: 12, background: TRACK, borderRadius: 6, overflow: 'hidden', width: `${(total / max) * 100}%`, minWidth: 6 }}>
                {r.values.map((v, i) => <div key={i} title={`${keys[i]}: ${format(v)}`} style={{ width: `${total ? (v / total) * 100 : 0}%`, background: SERIES[i] }} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Embudo ── */
export const Funnel = ({ steps, format }: { steps: { label: string; value: number }[]; format: (v: number) => string }) => {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{
          width: `${50 + (s.value / max) * 50}%`, background: SERIES[i % SERIES.length], color: i < 2 ? '#fff' : 'var(--atemporal-text)',
          borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem', transition: 'width .4s',
        }}>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
          <span style={{ fontWeight: 800 }}>{format(s.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Bloqueo por plan ── */
export const UpgradeCard = ({ feature, title, bullets }: { feature: PlanGateFeature; title: string; bullets: string[] }) => {
  const { tenant, requiredPlanFor } = usePlan();
  return (
    <div style={{
      borderRadius: 20, padding: '40px 32px', color: '#fff', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(140deg, var(--atemporal-green) 0%, var(--atemporal-green-dark) 100%)',
    }}>
      <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ position: 'relative', maxWidth: 560 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--atemporal-gold)' }}>
          {feature === 'ai' ? <Sparkles size={14} /> : <Lock size={14} />} Disponible desde el Plan {requiredPlanFor(feature)}
        </span>
        <h2 style={{ margin: '10px 0 8px', fontSize: '1.6rem', fontWeight: 800 }}>{title}</h2>
        <p style={{ margin: '0 0 18px', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
          Tu empresa está en el <b style={{ color: '#fff' }}>{tenant?.plan?.name ?? 'plan actual'}</b>. Mejora tu suscripción para desbloquear:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: 8 }}>
          {bullets.map((b) => (
            <li key={b} style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)' }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(201,144,74,0.25)', color: 'var(--atemporal-gold)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>✓</span>{b}
            </li>
          ))}
        </ul>
        <Link to="/pricing" className="dz-btn gold" style={{ textDecoration: 'none' }}>Ver planes y mejorar</Link>
      </div>
    </div>
  );
};

/** Muestra el contenido sólo si el plan lo permite; si no, la tarjeta de mejora. */
export const PlanGate = ({ feature, title, bullets, children }: { feature: PlanGateFeature; title: string; bullets: string[]; children: ReactNode }) => {
  const { can, loading } = usePlan();
  if (loading) return <Skeleton h={260} />;
  return can(feature) ? <>{children}</> : <UpgradeCard feature={feature} title={title} bullets={bullets} />;
};

export const downloadCsv = (filename: string, header: string[], rows: (string | number)[][]) => {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
