/**
 * Tipos y opciones de exportación de reportes con IA.
 * Sin dependencias pesadas: lo importa la página y también el generador de PDF/Excel.
 */

/** Tabla cruzada (dos agrupaciones): filas × columnas. */
export interface PivotData {
  rowLabel: string;
  columnLabel: string;
  series: string[];
  rows: { label: string; cells: number[]; total: number }[];
  columnTotals: number[] | null;
  grandTotal: number | null;
  truncatedSeries: number;
  additive: boolean;
}

export interface ReportInsight { type: string; text: string }

export interface ReportResult {
  question: string;
  engine: 'LLM' | 'LLM_LOCAL' | 'IA_LOCAL' | 'REGLAS';
  spec: { title: string; metric: string; dimension: string; dimension2?: string; chart: string; filters: Record<string, unknown>; limit: number };
  /** Encabezados de la tabla (con dos agrupaciones: fila, una columna por valor y "Total"). */
  columns: string[];
  metricLabel?: string;
  rows: { label: string; value: number }[];
  pivot?: PivotData;
  total: number;
  narrative: string;
  insights?: ReportInsight[];
  branchName: string | null;
  generatedAt: string;
}

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF (documento para imprimir)',
  excel: 'Excel (.xlsx, hoja de cálculo)',
  csv: 'CSV (datos simples)',
};

/** Tabla lista para exportar: la primera columna es texto y las demás son numéricas. */
export interface ExportTable {
  columns: string[];
  rows: (string | number)[][];
  /** Fila de totales (null en una celda = no se puede sumar). */
  totals?: (string | number | null)[];
}

/** Documento genérico que entienden los exportadores: sirve para reportes con IA y para la pantalla Reportes. */
export interface ExportDoc {
  title: string;
  generatedAt: string;
  /** Filas de la tabla "Filtro / contexto". */
  context: [string, string][];
  narrative?: string;
  /** Resultado único (KPI). */
  kpi?: { label: string; value: number };
  table?: ExportTable;
  /** Gráfico simple (no se dibuja en tablas cruzadas). */
  chart?: { kind: 'bar' | 'line'; rows: { label: string; value: number }[] };
  /** Nombre base del archivo, sin extensión. */
  fileName: string;
  /** Texto del origen del análisis (p. ej. "Intérprete local"). */
  origin?: string;
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
  /** Color principal de la empresa (#RRGGBB): cabeceras, títulos y gráficos de los archivos. */
  color?: string;
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
