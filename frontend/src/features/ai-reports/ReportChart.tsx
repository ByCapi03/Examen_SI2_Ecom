/** Gráficos SVG livianos (sin dependencias) para reportes generativos. */
import type { PivotData } from './exportOptions';

interface Row { label: string; value: number }

const fmt = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 });
const COLOR = 'var(--chart-1, #182D2A)';
const ACCENT = 'var(--chart-2, #C9904A)';

export const BarChart = ({ rows }: { rows: Row[] }) => {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 30%) 1fr auto', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div style={{ background: '#eee', borderRadius: 4, height: 18 }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 4, background: i === 0 ? ACCENT : COLOR }} />
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
};

export const LineChart = ({ rows, height = 220 }: { rows: Row[]; height?: number }) => {
  const w = 640, pad = 32;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const x = (i: number) => pad + (rows.length <= 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (rows.length - 1));
  const y = (v: number) => height - pad - (v / max) * (height - 2 * pad);
  const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.value)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height: 'auto' }} role="img">
      <line x1={pad} y1={height - pad} x2={w - pad} y2={height - pad} stroke="#ccc" />
      <text x={pad} y={pad - 10} fontSize="11" fill="#666">máx {fmt(max)}</text>
      <path d={d} fill="none" style={{ stroke: COLOR }} strokeWidth="2.5" />
      {rows.map((r, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(r.value)} r="3.5" style={{ fill: ACCENT }}><title>{`${r.label}: ${fmt(r.value)}`}</title></circle>
          {(rows.length <= 12 || i % Math.ceil(rows.length / 12) === 0) && (
            <text x={x(i)} y={height - pad + 16} fontSize="10" textAnchor="middle" fill="#666">{r.label.slice(5) || r.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
};

/** Mini serie para histórico + pronóstico (la parte pronosticada en línea punteada). */
export const Sparkline = ({ history, forecast }: { history: number[]; forecast: number[] }) => {
  const all = [...history, ...forecast];
  const w = 180, h = 40;
  const max = Math.max(...all, 1);
  const x = (i: number) => (i * w) / Math.max(all.length - 1, 1);
  const y = (v: number) => h - 2 - (v / max) * (h - 4);
  const hist = history.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const start = history.length - 1;
  const fc = [history[start] ?? 0, ...forecast].map((v, i) => `${i ? 'L' : 'M'}${x(start + i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <path d={hist} fill="none" style={{ stroke: COLOR }} strokeWidth="2" />
      <path d={fc} fill="none" style={{ stroke: ACCENT }} strokeWidth="2" strokeDasharray="4 3" />
    </svg>
  );
};

/**
 * Tabla cruzada como barras: apiladas cuando la métrica se puede sumar (cada segmento es una columna) y
 * agrupadas (una barra fina por columna) cuando no (p. ej. ticket promedio).
 */
export const PivotChart = ({ pivot, colors }: { pivot: PivotData; colors: string[] }) => {
  const stacked = pivot.additive;
  const max = Math.max(...(stacked ? pivot.rows.map((r) => r.total) : pivot.rows.flatMap((r) => r.cells)), 1);
  const color = (i: number) => colors[i % colors.length];
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 10, fontSize: 12 }}>
        {pivot.series.map((name, i) => (
          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: color(i), display: 'inline-block' }} />{name}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gap: stacked ? 8 : 12 }}>
        {pivot.rows.map((row) => (
          <div key={row.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 26%) 1fr auto', alignItems: stacked ? 'center' : 'start', gap: 8, fontSize: 13 }}>
            <span title={row.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
            {stacked ? (
              <div style={{ display: 'flex', background: 'var(--chart-track, #EEEAE1)', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                {row.cells.map((v, i) => v > 0 && (
                  <div key={i} title={`${pivot.series[i]}: ${fmt(v)}`} style={{ width: `${(v / max) * 100}%`, background: color(i) }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 3 }}>
                {row.cells.map((v, i) => (
                  <div key={i} title={`${pivot.series[i]}: ${fmt(v)}`} style={{ background: 'var(--chart-track, #EEEAE1)', borderRadius: 3, height: 8 }}>
                    <div style={{ width: `${(v / max) * 100}%`, height: '100%', borderRadius: 3, background: color(i) }} />
                  </div>
                ))}
              </div>
            )}
            <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>{fmt(row.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
