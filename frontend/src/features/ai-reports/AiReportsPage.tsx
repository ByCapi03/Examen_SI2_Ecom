import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useSettings } from '../../config/SettingsContext';
import { api } from '../../api/axios';
import { BarChart, LineChart, PivotChart } from './ReportChart';
import { DashStyles, PageHeader, PlanBadge, PlanGate } from '../../components/dashboard/ui';
import { CompanyThemeScope, useCompanyColor } from '../../components/dashboard/CompanyThemeScope';
import { ExportControl } from '../../components/dashboard/ExportControl';
import type { ReportResult, ExportOptions, ExportFormat } from './exportOptions';
import { EXPORT_OPTION_LABELS, loadExportOptions, saveExportOptions } from './exportOptions';
import { useAuth } from '../auth/AuthContext';
import { usePlan } from '../saas/PlanContext';

/**
 * REPORTES GENERATIVOS — el usuario pregunta en lenguaje natural y obtiene un
 * reporte construido con los datos reales de su empresa (aislado por tenant).
 */
export const AiReportsPage = () => (
  <div className="dz-page">
    <DashStyles />
    <CompanyThemeScope>
      <PageHeader title="Reportes con IA" subtitle="Pregunta en lenguaje natural y obtén un reporte con los datos reales de tu empresa" badge={<PlanBadge />} />
      <PlanGate feature="ai" title="Reportes generativos con IA" bullets={[
        'Consultas en lenguaje natural ("¿qué vestidos se vendieron más este mes?")',
        'Tablas, tablas cruzadas (por sucursal y por canal) y gráficos',
        'Historial de consultas y descarga en PDF, Excel o CSV',
        'Datos aislados por empresa (multitenant)',
      ]}>
        <AiReportsContent />
      </PlanGate>
    </CompanyThemeScope>
  </div>
);

const AiReportsContent = () => {
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportOpts, setExportOpts] = useState<ExportOptions>(loadExportOptions);
  const [showOpts, setShowOpts] = useState(false);
  const { user } = useAuth();
  const { tenant } = usePlan();
  const brand = useCompanyColor();

  const toggleOpt = (key: keyof ExportOptions) => {
    const next = { ...exportOpts, [key]: !exportOpts[key] };
    setExportOpts(next);
    saveExportOptions(next);
  };

  const { settings } = useSettings();
  const voice = useSpeechRecognition(settings.lang === 'en' ? 'en-US' : 'es-BO');
  const [autoSend, setAutoSend] = useState(true);
  const autoSendRef = useRef(true);
  autoSendRef.current = autoSend;

  const loadHistory = () => api.get('/ai-reports/history').then((r) => setHistory(r.data)).catch(() => {});

  useEffect(() => {
    api.get('/ai-reports/suggestions')
      .then((r) => { setSuggestions(r.data.suggestions); setLlmEnabled(r.data.llmEnabled); })
      .catch((e) => setError(e.response?.data?.message || 'No tiene acceso a reportes generativos'));
    void loadHistory();
  }, []);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setQuestion(q);
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/ai-reports/query', { question: q });
      setResult(data);
      void loadHistory();
    } catch (e: any) {
      setError(!e.response ? 'Los reportes generativos requieren conexión a Internet.' : e.response?.data?.message || 'No se pudo generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = () => {
    if (voice.listening) { voice.stop(); return; }
    setError(null);
    voice.start({
      onInterim: (t) => setQuestion(t),
      onFinal: (t) => { setQuestion(t); if (autoSendRef.current) void ask(t); },
    });
  };

  const meta = { companyName: tenant?.name, userName: user?.name, color: brand.color };

  const download = async (format: ExportFormat) => {
    if (!result) return;
    setExporting(true);
    setError(null);
    try {
      const { exportReport } = await import('./exportReport');
      await exportReport(result, format, exportOpts, meta);
    } catch {
      setError('No se pudo exportar el reporte. Inténtalo de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dz-card">
      <p style={{ color: 'var(--atemporal-muted)', marginTop: 0, fontSize: '0.85rem' }}>
        Motor: {llmEnabled ? 'IA generativa (LLM) con validación de seguridad' : 'intérprete de lenguaje natural local (configure AI_API_KEY para usar LLM)'}.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); void ask(question); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 0 }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500}
            placeholder={voice.listening ? 'Escuchando… habla ahora' : 'Ej.: ¿Cuáles fueron los 3 vestidos más vendidos este mes en la sucursal central?'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 52px 12px 14px', borderRadius: 10, border: `1.5px solid ${voice.listening ? '#DC2626' : 'var(--atemporal-border)'}`, background: 'var(--atemporal-white)', color: 'var(--atemporal-text)', fontSize: 15, fontFamily: 'inherit', outline: 'none' }} />
          <button type="button" onClick={toggleMic} disabled={!voice.supported}
            aria-label={voice.listening ? 'Detener dictado' : 'Dictar pregunta por voz'}
            title={voice.supported ? (voice.listening ? 'Detener dictado' : 'Dictar por voz') : 'Tu navegador no admite dictado por voz. Usa Chrome, Edge o Safari.'}
            className={voice.listening ? 'mic-live' : ''}
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: voice.supported ? 'pointer' : 'not-allowed', display: 'grid', placeItems: 'center',
              background: voice.listening ? '#DC2626' : 'var(--chart-track, #EEEAE1)', color: voice.listening ? '#fff' : 'var(--atemporal-text)', opacity: voice.supported ? 1 : 0.45 }}>
            {voice.listening ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
          </button>
        </div>
        <button type="submit" disabled={loading}
          style={{ padding: '12px 22px', borderRadius: 8, border: 'none', background: 'var(--atemporal-green)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Generando…' : 'Generar reporte'}
        </button>
      </form>

      <style>{'@keyframes micPulse { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,.5) } 100% { box-shadow: 0 0 0 12px rgba(220,38,38,0) } } .mic-live { animation: micPulse 1.2s infinite }'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, minHeight: 22, fontSize: 12.5 }}>
        {voice.listening && <span style={{ color: '#DC2626', fontWeight: 600 }}>● Escuchando… pulsa el cuadro para terminar</span>}
        {voice.error && <span role="alert" style={{ color: '#B91C1C' }}>{voice.error}</span>}
        {!voice.supported && <span style={{ color: 'var(--atemporal-muted)' }}>El dictado por voz requiere Chrome, Edge o Safari.</span>}
        {voice.supported && (
          <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--atemporal-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} /> Generar el reporte al terminar de hablar
          </label>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 20px' }}>
        {suggestions.map((s) => (
          <button key={s} onClick={() => void ask(s)}
            style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--atemporal-beige)', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
            {s}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#721c24', background: '#f8d7da', padding: 10, borderRadius: 4, marginBottom: 16 }}>{error}</div>}

      {result && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, border: '1px solid var(--atemporal-border)', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{result.spec.title}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: result.engine === 'LLM' ? '#e0e7ff' : '#f3f4f6' }}>
                {result.engine === 'LLM' ? 'Interpretado por IA' : 'Intérprete local'}
              </span>
              <ExportControl onExport={(f) => void download(f)} busy={exporting} />
              <button onClick={() => setShowOpts((v) => !v)} aria-expanded={showOpts}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--atemporal-border)', background: showOpts ? 'var(--company-soft)' : '#fff', cursor: 'pointer' }}>
                Qué incluir
              </button>
            </div>
          </div>
          {showOpts && (
            <fieldset style={{ border: '1px solid var(--atemporal-border)', borderRadius: 8, padding: '8px 12px', margin: '0 0 12px', display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
              <legend style={{ fontSize: 12, padding: '0 4px', color: 'var(--atemporal-muted)' }}>Qué incluir en PDF y Excel</legend>
              {(Object.keys(EXPORT_OPTION_LABELS) as (keyof ExportOptions)[]).map((key) => (
                <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={exportOpts[key]} onChange={() => toggleOpt(key)} />
                  {EXPORT_OPTION_LABELS[key]}
                </label>
              ))}
            </fieldset>
          )}
          <div style={{ fontSize: 12, color: '#777', margin: '4px 0 12px' }}>
            {result.metricLabel ?? result.columns[1]} {result.pivot ? `por ${result.pivot.rowLabel.toLowerCase()} y ${result.pivot.columnLabel.toLowerCase()}` : result.spec.dimension !== 'ninguna' ? `por ${result.columns[0].toLowerCase()}` : ''}
            {result.spec.filters.dateFrom ? ` · ${result.spec.filters.dateFrom} a ${result.spec.filters.dateTo ?? 'hoy'}` : ' · todo el período'}
            {result.branchName ? ` · ${result.branchName}` : ''}
            {result.spec.filters.category ? ` · categoría ${result.spec.filters.category}` : ''}
            {result.spec.filters.channel ? ` · canal ${result.spec.filters.channel}` : ''}
          </div>

          <div style={{ background: 'var(--company-soft)', borderLeft: '4px solid var(--atemporal-green)', padding: '10px 14px', borderRadius: 4, marginBottom: 16 }}>
            {result.narrative}
          </div>
          {result.pivot && result.insights && result.insights.length > 0 && (
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: 'var(--atemporal-text)' }}>
              {result.insights.slice(-5).map((i, k) => <li key={k}>{i.text}</li>)}
            </ul>
          )}

          {result.rows.length === 0 ? <div style={{ color: '#666' }}>Sin datos para los filtros interpretados.</div>
            : result.spec.chart === 'kpi' ? (
              <div style={{ fontSize: 40, fontWeight: 700 }}>{result.rows[0].value.toLocaleString('es-BO', { maximumFractionDigits: 2 })}
                <div style={{ fontSize: 14, fontWeight: 400, color: '#666' }}>{result.metricLabel ?? result.columns[1]}</div></div>
            ) : result.pivot ? <PivotChart pivot={result.pivot} colors={brand.palette(Math.max(result.pivot.series.length, 2))} />
              : result.spec.chart === 'line' ? <LineChart rows={result.rows} />
                : result.spec.chart === 'table' ? null : <BarChart rows={result.rows} />}

          {result.rows.length > 0 && result.spec.chart !== 'kpi' && <ResultTable result={result} />}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h4>Consultas recientes</h4>
          <ul style={{ paddingLeft: 18 }}>
            {history.map((h) => (
              <li key={h.id} style={{ marginBottom: 4 }}>
                <button onClick={() => void ask(h.question)} style={{ background: 'none', border: 'none', color: 'var(--atemporal-green)', textDecoration: 'underline', cursor: 'pointer', padding: 0, textAlign: 'left' }}>{h.question}</button>
                <span style={{ color: '#999', fontSize: 12 }}> · {new Date(h.createdAt).toLocaleString()} · {h.engine} · {h.rowCount} filas</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const num = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 });

/** Tabla del reporte (siempre visible). Con dos agrupaciones es una tabla cruzada con totales por fila y columna. */
const ResultTable = ({ result }: { result: ReportResult }) => {
  const p = result.pivot;
  const th: React.CSSProperties = { padding: '9px 10px', background: 'var(--atemporal-green)', color: 'var(--company-on)', fontSize: 12, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--atemporal-border)', fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{ marginTop: 18, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left', borderTopLeftRadius: 8 }}>{result.columns[0]}</th>
            {p
              ? <>{p.series.map((sName) => <th key={sName} style={{ ...th, textAlign: 'right' }}>{sName}</th>)}<th style={{ ...th, textAlign: 'right', borderTopRightRadius: 8 }}>Total</th></>
              : <th style={{ ...th, textAlign: 'right', borderTopRightRadius: 8 }}>{result.columns[1]}</th>}
          </tr>
        </thead>
        <tbody>
          {p ? p.rows.map((row, i) => (
            <tr key={row.label} style={{ background: i % 2 ? 'var(--company-soft)' : undefined }}>
              <td style={td}>{row.label}</td>
              {row.cells.map((v, k) => <td key={k} style={{ ...td, textAlign: 'right' }}>{num(v)}</td>)}
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{num(row.total)}</td>
            </tr>
          )) : result.rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? 'var(--company-soft)' : undefined }}>
              <td style={td}>{r.label}</td>
              <td style={{ ...td, textAlign: 'right' }}>{num(r.value)}</td>
            </tr>
          ))}
        </tbody>
        {p && p.columnTotals && (
          <tfoot>
            <tr style={{ fontWeight: 700, color: 'var(--atemporal-green)' }}>
              <td style={{ ...td, borderTop: '2px solid var(--atemporal-green)', borderBottom: 'none' }}>Total</td>
              {p.columnTotals.map((v, k) => <td key={k} style={{ ...td, textAlign: 'right', borderTop: '2px solid var(--atemporal-green)', borderBottom: 'none' }}>{num(v)}</td>)}
              <td style={{ ...td, textAlign: 'right', borderTop: '2px solid var(--atemporal-green)', borderBottom: 'none' }}>{p.grandTotal != null ? num(p.grandTotal) : '—'}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {p && !p.additive && <div style={{ fontSize: 12, color: '#777', marginTop: 6 }}>Esta métrica no se puede sumar entre columnas: los totales por columna no se muestran.</div>}
      {p && p.truncatedSeries > 0 && <div style={{ fontSize: 12, color: '#777', marginTop: 6 }}>Se muestran las {p.series.length} columnas principales; {p.truncatedSeries} más quedaron fuera.</div>}
    </div>
  );
};
