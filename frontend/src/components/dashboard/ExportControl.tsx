import { useState } from 'react';
import { Download } from 'lucide-react';
import { EXPORT_FORMAT_LABELS, type ExportFormat } from '../../features/ai-reports/exportOptions';

const KEY = 'reportes.formatoExportacion';
const read = (): ExportFormat => {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'pdf' || v === 'excel' || v === 'csv' ? v : 'excel';
  } catch {
    return 'excel';
  }
};

/** Selector de formato (PDF, Excel, CSV) y botón de descarga. Recuerda el último formato elegido. */
export const ExportControl = ({ onExport, disabled, busy }: { onExport: (format: ExportFormat) => void; disabled?: boolean; busy?: boolean }) => {
  const [format, setFormat] = useState<ExportFormat>(read);
  const choose = (f: ExportFormat) => {
    setFormat(f);
    try { window.localStorage.setItem(KEY, f); } catch { /* solo dura esta sesión */ }
  };
  return (
    <div role="group" aria-label="Descargar reporte" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--atemporal-muted)' }}>
        Descargar como
        <select className="dz-input" value={format} onChange={(e) => choose(e.target.value as ExportFormat)} disabled={disabled || busy} style={{ padding: '6px 8px' }}>
          {(Object.keys(EXPORT_FORMAT_LABELS) as ExportFormat[]).map((f) => <option key={f} value={f}>{EXPORT_FORMAT_LABELS[f]}</option>)}
        </select>
      </label>
      <button className="dz-btn" onClick={() => onExport(format)} disabled={disabled || busy} style={{ padding: '7px 14px' }}>
        <Download size={15} /> {busy ? 'Generando…' : 'Descargar'}
      </button>
    </div>
  );
};
