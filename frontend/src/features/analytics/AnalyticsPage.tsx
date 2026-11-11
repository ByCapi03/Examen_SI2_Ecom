import { useEffect, useState } from 'react';
import { api } from '../../api/axios';
import { DashStyles, PageHeader, PlanBadge, PlanGate } from '../../components/dashboard/ui';
import { useAuth } from '../auth/AuthContext';

/**
 * ANALÍTICA PREDICTIVA (Plan Profesional)
 *  - Pronóstico de demanda: aprendizaje supervisado (regresión lineal).
 *  - Segmentación de clientes: aprendizaje no supervisado (K-Means sobre RFM).
 */
export const AnalyticsPage = () => (
  <div className="dz-page">
    <DashStyles />
    <PageHeader title="Analítica predictiva (ML)" subtitle="Modelos de Machine Learning entrenados con el historial de tu empresa" badge={<PlanBadge />} />
    <PlanGate feature="ai" title="Machine Learning para tu tienda" bullets={[
      'Pronóstico de demanda por producto (aprendizaje supervisado)',
      'Stock de seguridad y sugerencias de reposición',
      'Segmentación de clientes K-Means sobre RFM (no supervisado)',
      'Acciones sugeridas por segmento',
    ]}>
      <AnalyticsContent />
    </PlanGate>
  </div>
);


const RISK_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  QUIEBRE: { color: '#B91C1C', bg: '#FEE2E2', label: 'Sin stock' },
  REPONER: { color: '#B45309', bg: '#FEF3C7', label: 'Reponer' },
  OK: { color: '#15803D', bg: '#DCFCE7', label: 'Stock suficiente' },
};
const CONF_STYLE: Record<string, { color: string; bg: string; hint: string }> = {
  ALTA: { color: '#15803D', bg: '#DCFCE7', hint: 'Las ventas siguen un patrón estable: el pronóstico es confiable.' },
  MEDIA: { color: '#B45309', bg: '#FEF3C7', hint: 'Las ventas varían bastante de una semana a otra: úsalo como referencia.' },
  BAJA: { color: '#B91C1C', bg: '#FEE2E2', hint: 'Ventas muy irregulares o pocas semanas con ventas: tómalo solo como orientación.' },
};

const Badge = ({ text, color, bg, title }: { text: string; color: string; bg: string; title?: string }) => (
  <span title={title} style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color, background: bg, whiteSpace: 'nowrap' }}>{text}</span>
);

/** Barras = unidades vendidas por semana; barras claras = pronóstico. Al pasar el mouse sobre una barra se ve su valor. */
const DemandChart = ({ history, forecast }: { history: number[]; forecast: number[] }) => {
  const all = [...history, ...forecast];
  const W = 250, H = 84, padL = 30, padB = 16, padT = 6;
  const max = Math.max(...all, 1);
  const niceMax = Math.ceil(max / 10) * 10 || 10;
  const bw = (W - padL) / all.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / niceMax);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Unidades vendidas por semana y pronóstico">
      {[0, niceMax / 2, niceMax].map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--atemporal-border)' }} strokeWidth="1" />
          <text x={padL - 4} y={y(t) + 3} fontSize="9" textAnchor="end" style={{ fill: 'var(--atemporal-muted)' }}>{Math.round(t)}</text>
        </g>
      ))}
      {all.map((v, i) => {
        const isForecast = i >= history.length;
        const label = isForecast ? `Pronóstico: semana +${i - history.length + 1}` : `Hace ${history.length - i} sem.`;
        return (
          <rect key={i} x={padL + i * bw + 1} y={y(v)} width={Math.max(bw - 2, 1)} height={Math.max(y(0) - y(v), v > 0 ? 1 : 0)} rx="1.5"
            style={{ fill: isForecast ? 'var(--atemporal-gold)' : 'var(--atemporal-green)', opacity: isForecast ? 0.6 : 0.9 }}>
            <title>{`${label}: ${Math.round(v)} u.`}</title>
          </rect>
        );
      })}
      <line x1={padL + history.length * bw} x2={padL + history.length * bw} y1={padT} y2={H - padB} style={{ stroke: 'var(--atemporal-muted)' }} strokeDasharray="3 3" strokeWidth="1" />
      <text x={padL} y={H - 3} fontSize="9" style={{ fill: 'var(--atemporal-muted)' }}>hace {history.length} sem.</text>
      <text x={padL + history.length * bw + 3} y={H - 3} fontSize="9" style={{ fill: 'var(--atemporal-gold)' }}>pronóstico</text>
    </svg>
  );
};

const trendText = (p: any) => {
  const pct = Math.abs(p.weeklyChangePct);
  if (p.trend === 'CRECIENTE') return <span style={{ color: '#15803D', fontWeight: 600 }}>▲ Sube {pct}% por semana</span>;
  if (p.trend === 'DECRECIENTE') return <span style={{ color: '#B91C1C', fontWeight: 600 }}>▼ Baja {pct}% por semana</span>;
  return <span style={{ color: 'var(--atemporal-muted)', fontWeight: 600 }}>■ Estable</span>;
};

const DemandHelp = ({ horizon, weeks }: { horizon: number; weeks: number }) => (
  <details open style={{ background: 'var(--atemporal-bg, #F4F1EA)', border: '1px solid var(--atemporal-border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem', lineHeight: 1.55 }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>¿Qué es esto y cómo se lee?</summary>
    <p style={{ margin: '8px 0' }}>
      El sistema mira cuántas unidades vendiste de cada producto en las últimas <b>{weeks} semanas completas</b>, traza la línea de tendencia que mejor las
      resume (<i>aprendizaje supervisado: regresión lineal</i>) y la prolonga <b>{horizon} semana(s)</b> hacia adelante. Con eso estima cuánto venderás y si te alcanza el stock.
    </p>
    <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
      <li><b>Barras oscuras:</b> unidades vendidas cada semana. <b>Barras claras:</b> lo que se espera vender. Pasa el mouse para ver el número.</li>
      <li><b>Stock de seguridad:</b> unidades extra que conviene tener por si las ventas suben más de lo esperado (cubre el 95 % de los casos).</li>
      <li><b>Reponer</b> = ventas esperadas + stock de seguridad − stock actual. Si es 0 o menos, no hace falta comprar.</li>
      <li><b>Confianza:</b> qué tan parecidas son las ventas reales a la línea. Si es <b>baja</b>, el pronóstico es solo una orientación.</li>
      <li>La semana en curso no se usa para entrenar porque todavía está incompleta.</li>
    </ul>
  </details>
);

const DemandRow = ({ p, horizon }: { p: any; horizon: number }) => {
  const [open, setOpen] = useState(false);
  const risk = RISK_STYLE[p.risk];
  const conf = CONF_STYLE[p.confidence];
  const slopeAbs = Math.abs(p.slope).toFixed(1);
  const slope = `${p.slope > 0 ? '+' : p.slope < 0 ? '−' : ''}${slopeAbs}`;
  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)} title="Clic para ver el detalle del cálculo">
        <td style={{ fontWeight: 700 }}>{p.productName}<div style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--atemporal-muted)', margin: '2px 0 5px' }}>Promedio: {p.avgWeeklyUnits} u./semana</div><Badge text={`Confianza ${p.confidence.toLowerCase()}`} color={conf.color} bg={conf.bg} title={conf.hint} /></td>
        <td><DemandChart history={p.history} forecast={p.forecast} /></td>
        <td>{trendText(p)}</td>
        <td style={{ textAlign: 'right' }}><b>{Math.round(p.forecastTotal)}</b> u.<div style={{ fontSize: '0.72rem', color: 'var(--atemporal-muted)' }}>en {horizon} sem.</div></td>
        <td style={{ textAlign: 'right' }}><b>{p.availableStock}</b> u.<div style={{ fontSize: '0.72rem', color: 'var(--atemporal-muted)' }}>{p.daysOfStock == null ? 'sin demanda' : `te duran ≈ ${Math.round(p.daysOfStock)} días`}</div></td>
        <td style={{ whiteSpace: 'normal', minWidth: 230, maxWidth: 330 }}>
          <Badge text={p.suggestedReorder > 0 ? `${risk.label}: comprar ${p.suggestedReorder} u.` : risk.label} color={risk.color} bg={risk.bg} />
          <div style={{ fontSize: '0.78rem', marginTop: 5, lineHeight: 1.4 }}>{p.action}</div>
        </td>
        <td style={{ color: 'var(--atemporal-muted)' }}>{open ? '▲' : '▼'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--atemporal-bg, #F4F1EA)', whiteSpace: 'normal', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <b>Detalle del cálculo</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <li><b>Reposición:</b> {Math.round(p.forecastTotal)} (ventas esperadas) + {p.safetyStock} (stock de seguridad) − {p.availableStock} (stock actual) = <b>{Math.max(0, Math.round(p.forecastTotal) + p.safetyStock - p.availableStock)}</b>{Math.round(p.forecastTotal) + p.safetyStock - p.availableStock <= 0 ? ' → no hace falta comprar' : ''}</li>
              <li><b>Pendiente de la línea:</b> {slope} unidades por semana (cada semana se vende {slopeAbs} u. {p.slope >= 0 ? 'más' : 'menos'} que la anterior).</li>
              <li><b>R² = {p.r2}</b> (0 a 1): qué parte de la variación de las ventas explica la línea. Cercano a 1 = patrón claro; cercano a 0 = ventas sin tendencia (si además el error es bajo, el producto es simplemente estable).</li>
              <li><b>MAE = {p.mae ?? '—'}</b>: error promedio en unidades por semana al predecir las últimas 2 semanas con el modelo entrenado sin ellas.</li>
              <li><b>Confianza {p.confidence}:</b> {conf.hint}</li>
            </ul>
          </td>
        </tr>
      )}
    </>
  );
};

const DemandTab = ({ demand, weeks, horizon, setWeeks, setHorizon }: { demand: any; weeks: number; horizon: number; setWeeks: (n: number) => void; setHorizon: (n: number) => void }) => {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'ok'>('all');
  const products: any[] = demand?.products ?? [];
  const urgent = products.filter((p) => p.risk !== 'OK');
  const noStock = products.filter((p) => p.risk === 'QUIEBRE').length;
  const units = products.reduce((a, p) => a + p.suggestedReorder, 0);
  const shown = filter === 'urgent' ? urgent : filter === 'ok' ? products.filter((p) => p.risk === 'OK') : products;
  const chip = (id: typeof filter, label: string) => (
    <button key={id} onClick={() => setFilter(id)} className={`dz-btn ${filter === id ? '' : 'ghost'}`} style={{ padding: '6px 14px', fontSize: '0.78rem' }}>{label}</button>
  );
  const card = (label: string, value: string, color: string) => (
    <div className="dz-card" style={{ padding: '12px 16px', flex: '1 1 150px' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--atemporal-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );
  return (
    <>
      <DemandHelp horizon={horizon} weeks={weeks} />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <label>Historial: <select className="dz-input" value={weeks} onChange={(e) => setWeeks(+e.target.value)}>{[8, 12, 26, 52].map((w) => <option key={w} value={w}>{w} semanas</option>)}</select></label>
        <label>Pronosticar: <select className="dz-input" value={horizon} onChange={(e) => setHorizon(+e.target.value)}>{[1, 2, 4, 8].map((h) => <option key={h} value={h}>próximas {h} semana(s)</option>)}</select></label>
      </div>
      {products.length === 0 && <div style={{ color: 'var(--atemporal-muted)' }}>Todavía no hay ventas completas en las últimas {weeks} semanas para entrenar el modelo.</div>}
      {products.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            {card('Productos a reponer', `${urgent.length} de ${products.length}`, urgent.length ? '#B45309' : '#15803D')}
            {card('Sin stock', String(noStock), noStock ? '#B91C1C' : '#15803D')}
            {card('Unidades a comprar', String(units), 'var(--atemporal-text)')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {chip('all', `Todos (${products.length})`)}{chip('urgent', `Urgentes (${urgent.length})`)}{chip('ok', `Stock suficiente (${products.length - urgent.length})`)}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="dz-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Producto</th><th>Ventas por semana</th><th>Tendencia</th>
                  <th style={{ textAlign: 'right' }}>Se venderían</th><th style={{ textAlign: 'right' }}>Stock actual</th>
                  <th>Qué hacer</th><th />
                </tr>
              </thead>
              <tbody>{shown.map((p) => <DemandRow key={p.productId} p={p} horizon={demand.horizon} />)}</tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: 'var(--atemporal-muted)' }}>Ordenado por urgencia. Haz clic en un producto para ver cómo se calculó. {demand.model}.</p>
        </>
      )}
    </>
  );
};

const AnalyticsContent = () => {
  const [tab, setTab] = useState<'demand' | 'segments'>('demand');
  const [weeks, setWeeks] = useState(12);
  const [horizon, setHorizon] = useState(4);
  const [k, setK] = useState(4);
  const [demand, setDemand] = useState<any>(null);
  const [segments, setSegments] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = !!user?.roles?.includes('ADMIN');
  const [models, setModels] = useState<any[]>([]);
  const [training, setTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState<string | null>(null);

  const loadModels = async () => {
    try { setModels((await api.get('/analytics/models')).data.filter((m: any) => m.active)); } catch { /* sin modelos */ }
  };

  const train = async () => {
    setTraining(true); setTrainMsg(null); setError(null);
    try {
      const { data } = await api.post('/analytics/train', { weeks: 26, k: 4 });
      setTrainMsg(data.warnings?.length ? data.warnings.join(' ') : 'Modelos entrenados y guardados correctamente.');
      await loadModels();
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'No se pudo entrenar los modelos');
    } finally {
      setTraining(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'demand') setDemand((await api.get('/analytics/demand-forecast', { params: { weeks, horizon } })).data);
      else setSegments((await api.get('/analytics/customer-segments', { params: { k } })).data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'No se pudo cargar la analítica');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tab, weeks, horizon, k]);
  useEffect(() => { void loadModels(); }, []);

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{ padding: '8px 16px', border: 'none', borderBottom: tab === t ? '3px solid var(--atemporal-gold)' : '3px solid transparent', background: 'none', color: 'var(--atemporal-text)', fontFamily: 'inherit', fontWeight: tab === t ? 700 : 400, cursor: 'pointer' }}>{label}</button>
  );

  return (
    <div className="dz-card">
      <div style={{ border: '1px solid var(--atemporal-border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <strong>Modelos entrenados</strong>
          {isAdmin && (
            <button onClick={train} disabled={training} className="dz-btn" style={{ padding: '6px 14px', cursor: training ? 'wait' : 'pointer' }}>
              {training ? 'Entrenando…' : models.length ? 'Reentrenar modelos' : 'Entrenar modelos'}
            </button>
          )}
        </div>
        {trainMsg && <div style={{ color: '#15803d', fontSize: 13, marginTop: 8 }}>{trainMsg}</div>}
        {models.length === 0 && <div style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Aún no hay modelos entrenados: las predicciones se ajustan en línea. {isAdmin ? 'Entrénalos para guardarlos y evaluarlos.' : 'Un administrador debe entrenarlos.'}</div>}
        {models.map((m) => (
          <div key={m.id} style={{ fontSize: 13, marginTop: 8, color: 'var(--atemporal-text)' }}>
            <b>{m.name === 'DEMAND_FORECAST' ? 'Pronóstico de demanda' : 'Segmentación de clientes'}</b> · versión {m.version} · {m.learningType === 'SUPERVISADO' ? 'supervisado' : 'no supervisado'} · {new Date(m.trainedAt).toLocaleString()}
            <div style={{ color: '#666' }}>
              Datos: {m.dataSource.realSales} ventas reales + {m.dataSource.syntheticSales} sintéticas
              {m.metrics?.evaluation && <> · Error (MAE) {m.metrics.evaluation.maeModel} vs. baseline {m.metrics.evaluation.maeNaive} {m.metrics.evaluation.improvementPct >= 0
                ? <> ({m.metrics.evaluation.improvementPct}% de mejora)</>
                : <> — <b style={{ color: '#b45309' }}>no supera al baseline</b> ({m.metrics.evaluation.improvementPct}%): con estas ventas una recta no es mejor que repetir el promedio reciente</>}</>}
              {m.metrics?.silhouette != null && <> · Silueta {m.metrics.silhouette} · {m.metrics.clients} clientes</>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--atemporal-border)', marginBottom: 16, flexWrap: 'wrap' }}>
        {tabBtn('demand', 'Pronóstico de demanda (supervisado)')}
        {tabBtn('segments', 'Segmentación de clientes (no supervisado)')}
      </div>
      {error && <div style={{ color: '#721c24', background: '#f8d7da', padding: 10, borderRadius: 4, marginBottom: 16 }}>{error}</div>}
      {loading && <div>Calculando modelo…</div>}

      {tab === 'demand' && <DemandTab demand={demand} weeks={weeks} horizon={horizon} setWeeks={setWeeks} setHorizon={setHorizon} />}

      {tab === 'segments' && (
        <>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <label>Número de segmentos (k): <select value={k} onChange={(e) => setK(+e.target.value)}>{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            {segments && <span style={{ color: '#666', fontSize: 13 }}>{segments.model} · {segments.clients} clientes · silueta {segments.silhouette ?? '—'}</span>}
          </div>
          {segments?.message && <div style={{ color: '#666' }}>{segments.message}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {segments?.segments?.map((s: any) => (
              <div key={s.cluster} style={{ background: 'var(--atemporal-white)', borderRadius: 10, padding: 16, border: '1px solid var(--atemporal-border)' }}>
                <h3 style={{ margin: '0 0 4px' }}>{s.name}</h3>
                <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>{s.size} cliente(s)</div>
                <div style={{ fontSize: 13 }}>Recencia media: <b>{s.avgRecencyDays} días</b></div>
                <div style={{ fontSize: 13 }}>Frecuencia media: <b>{s.avgFrequency} compras</b></div>
                <div style={{ fontSize: 13 }}>Gasto medio: <b>Bs {s.avgMonetary.toLocaleString('es-BO')}</b></div>
                <div style={{ fontSize: 13, marginTop: 8, color: '#8a4b08' }}>Acción sugerida: {s.suggestedAction}</div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13 }}>Ver clientes</summary>
                  <ul style={{ paddingLeft: 16, fontSize: 12 }}>
                    {s.clients.map((c: any) => <li key={c.id}>{c.name} — {c.frequency} compras, Bs {c.monetary.toLocaleString('es-BO')}</li>)}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
