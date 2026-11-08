import { useEffect, useState } from 'react';
import { api } from '../../api/axios';
import { BarChart, LineChart } from './ReportChart';

interface ReportResult {
  question: string;
  engine: 'LLM' | 'REGLAS';
  spec: { title: string; metric: string; dimension: string; chart: string; filters: Record<string, any>; limit: number };
  columns: [string, string];
  rows: { label: string; value: number }[];
  total: number;
  narrative: string;
  branchName: string | null;
  generatedAt: string;
}

/**
 * REPORTES GENERATIVOS — el usuario pregunta en lenguaje natural y obtiene un
 * reporte construido con los datos reales de su empresa (aislado por tenant).
 */
export const AiReportsPage = () => {
  const [question, setQuestion] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const exportCsv = () => {
    if (!result) return;
    const lines = [result.columns.join(','), ...result.rows.map((r) => `"${r.label.replace(/"/g, '""')}",${r.value}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-ia-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div style={{ paddingTop: 24 }}>
      <h2 style={{ marginBottom: 4 }}>Reportes con IA</h2>
      <p style={{ color: '#666', marginTop: 0 }}>
        Pregunte en lenguaje natural. El reporte se construye con los datos reales de su empresa.
        Motor: {llmEnabled ? 'IA generativa (LLM) con validación de seguridad' : 'intérprete de lenguaje natural local (configure AI_API_KEY para usar LLM)'}.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); void ask(question); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500}
          placeholder="Ej.: ¿Cuáles fueron los 3 vestidos más vendidos este mes en la sucursal central?"
          style={{ flex: '1 1 320px', padding: '12px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: 15 }} />
        <button type="submit" disabled={loading}
          style={{ padding: '12px 22px', borderRadius: 8, border: 'none', background: 'var(--atemporal-green)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Generando…' : 'Generar reporte'}
        </button>
      </form>

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
              <button onClick={exportCsv} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Exportar CSV</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#777', margin: '4px 0 12px' }}>
            {result.columns[1]} {result.spec.dimension !== 'ninguna' ? `por ${result.columns[0].toLowerCase()}` : ''}
            {result.spec.filters.dateFrom ? ` · ${result.spec.filters.dateFrom} a ${result.spec.filters.dateTo ?? 'hoy'}` : ' · todo el período'}
            {result.branchName ? ` · ${result.branchName}` : ''}
            {result.spec.filters.category ? ` · categoría ${result.spec.filters.category}` : ''}
            {result.spec.filters.channel ? ` · canal ${result.spec.filters.channel}` : ''}
          </div>

          <div style={{ background: '#F5F2EB', borderLeft: '4px solid var(--atemporal-gold)', padding: '10px 14px', borderRadius: 4, marginBottom: 16 }}>
            {result.narrative}
          </div>

          {result.rows.length === 0 ? <div style={{ color: '#666' }}>Sin datos para los filtros interpretados.</div>
            : result.spec.chart === 'kpi' ? (
              <div style={{ fontSize: 40, fontWeight: 700 }}>{result.rows[0].value.toLocaleString('es-BO', { maximumFractionDigits: 2 })}
                <div style={{ fontSize: 14, fontWeight: 400, color: '#666' }}>{result.columns[1]}</div></div>
            ) : result.spec.chart === 'line' ? <LineChart rows={result.rows} /> : <BarChart rows={result.rows} />}

          {result.rows.length > 0 && result.spec.chart !== 'kpi' && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer' }}>Ver tabla de datos ({result.rows.length} filas)</summary>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13 }}>
                <thead><tr><th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>{result.columns[0]}</th><th style={{ textAlign: 'right', borderBottom: '1px solid #ddd' }}>{result.columns[1]}</th></tr></thead>
                <tbody>{result.rows.map((r, i) => (
                  <tr key={i}><td style={{ padding: 4 }}>{r.label}</td><td style={{ padding: 4, textAlign: 'right' }}>{r.value.toLocaleString('es-BO', { maximumFractionDigits: 2 })}</td></tr>
                ))}</tbody>
              </table>
            </details>
          )}
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
