/**
 * Tipos y opciones de exportación de reportes con IA.
 * Sin dependencias pesadas: lo importa la página y también el generador de PDF/Excel.
 */

export interface ReportResult {
  question: string;
  engine: 'LLM' | 'REGLAS';
  spec: { title: string; metric: string; dimension: string; chart: string; filters: Record<string, unknown>; limit: number };
  columns: [string, string];
  rows: { label: string; value: number }[];
  total: number;
  narrative: string;
  branchName: string | null;
  generatedAt: string;
}

/** Qué secciones incluye la exportación. */
export interface ExportOptions {
  header: boolean;    // empresa, "Generado el" y "Por"
  context: boolean;   // tabla "Filtro / contexto" (empresa, solicitud, período, sucursal…)
  narrative: boolean; // resumen en texto
  chart: boolean;     // gráfico (repite los datos de la tabla)
  table: boolean;     // tabla de datos
  total: boolean;     // fila de total
  footer: boolean;    // pie de página con fecha y número de página
}

/** El gráfico va apagado: repite los mismos datos que la tabla. */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  header: true, context: true, narrative: true, chart: false, table: true, total: true, footer: true,
};

export const EXPORT_OPTION_LABELS: Record<keyof ExportOptions, string> = {
  header: 'Encabezado (empresa, fecha y usuario)',
  context: 'Tabla de filtros y contexto',
  narrative: 'Resumen en texto',
  chart: 'Gráfico (repite los datos de la tabla)',
  table: 'Tabla de datos',
  total: 'Fila de total',
  footer: 'Pie de página con número de página',
};

export interface ExportMeta {
  companyName?: string;
  userName?: string;
}

const STORAGE_KEY = 'reporteIA.exportOptions';

/** Preferencias guardadas en este navegador. Si el almacenamiento no está disponible, usa los valores por defecto. */
export const loadExportOptions = (): ExportOptions => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EXPORT_OPTIONS;
    return { ...DEFAULT_EXPORT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_EXPORT_OPTIONS;
  }
};

export const saveExportOptions = (opts: ExportOptions) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {
    /* sin almacenamiento: la preferencia solo dura esta sesión */
  }
};
