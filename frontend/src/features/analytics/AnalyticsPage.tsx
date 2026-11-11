import { useEffect, useState } from 'react';
import { api } from '../../api/axios';
import { Sparkline } from '../ai-reports/ReportChart';
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

  const riskColor: Record<string, string> = { QUIEBRE: '#b91c1c', REPONER: '#b45309', OK: '#15803d' };
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
              {m.metrics?.evaluation && <> · Error (MAE) {m.metrics.evaluation.maeModel} vs. baseline {m.metrics.evaluation.maeNaive} ({m.metrics.evaluation.improvementPct >= 0 ? '+' : ''}{m.metrics.evaluation.improvementPct}% de mejora)</>}
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

      {tab === 'demand' && (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <label>Historial: <select value={weeks} onChange={(e) => setWeeks(+e.target.value)}>{[8, 12, 26, 52].map((w) => <option key={w} value={w}>{w} semanas</option>)}</select></label>
            <label>Horizonte: <select value={horizon} onChange={(e) => setHorizon(+e.target.value)}>{[1, 2, 4, 8].map((h) => <option key={h} value={h}>{h} semana(s)</option>)}</select></label>
            {demand && <span style={{ color: '#666', fontSize: 13 }}>{demand.model}</span>}
          </div>
          {demand?.products?.length === 0 && <div style={{ color: '#666' }}>No hay ventas suficientes en el período para entrenar el modelo.</div>}
          {demand?.products?.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <style>{'.ml-table th, .ml-table td { padding: 8px 10px; white-space: nowrap; }'}</style>
              <table className="ml-table" style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--atemporal-white)', color: 'var(--atemporal-text)', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: 8 }}>Producto</th><th>Histórico → pronóstico</th><th>Tendencia</th>
                    <th style={{ textAlign: 'right' }}>Demanda {demand.horizon} sem.</th><th style={{ textAlign: 'right' }}>Stock disp.</th>
                    <th style={{ textAlign: 'right' }}>Stock seguridad</th><th style={{ textAlign: 'right' }}>Reponer</th><th>R² / MAE</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {demand.products.map((p: any) => (
                    <tr key={p.productId} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8 }}>{p.productName}</td>
                      <td><Sparkline history={p.history} forecast={p.forecast} /></td>
                      <td>{p.trend === 'CRECIENTE' ? '▲ Creciente' : p.trend === 'DECRECIENTE' ? '▼ Decreciente' : '■ Estable'}</td>
                      <td style={{ textAlign: 'right' }}>{p.forecastTotal}</td>
                      <td style={{ textAlign: 'right' }}>{p.availableStock}</td>
                      <td style={{ textAlign: 'right' }}>{p.safetyStock}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.suggestedReorder}</td>
                      <td>{p.r2} / {p.mae ?? '—'}</td>
                      <td style={{ color: riskColor[p.risk], fontWeight: 600 }}>{p.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: '#777' }}>Línea sólida: unidades vendidas por semana. Línea punteada: pronóstico. Reponer = demanda pronosticada + stock de seguridad (95%) − stock disponible.</p>
            </div>
          )}
        </>
      )}

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
