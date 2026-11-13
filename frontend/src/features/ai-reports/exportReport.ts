/**
 * EXPORTACIÓN DE REPORTES CON IA — PDF y Excel.
 *
 * El usuario elige qué secciones incluir (ExportOptions). Por defecto el gráfico
 * va desactivado porque repite los mismos datos que la tabla.
 * Las librerías (ExcelJS, jsPDF) se cargan con import() dinámico desde AiReportsPage.
 */
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DEFAULT_EXPORT_OPTIONS, type ExportMeta, type ExportOptions, type ReportResult,
} from './exportOptions';

export type { ExportMeta, ExportOptions, ReportResult } from './exportOptions';
export { DEFAULT_EXPORT_OPTIONS, EXPORT_OPTION_LABELS } from './exportOptions';

// Estilo del reporte de FashionStore: granate, gris y blanco
const BURGUNDY = '#8B2C36';
const TEXT = '#333333';
const MUTED = '#666666';
const ZEBRA = '#F5F5F5';
const RULE = '#DDDDDD';
const TRACK = '#EEEEEE';
const NUMBER_FORMAT = '#,##0.00';

const fmt = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 });
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const argb = (hex: string) => `FF${hex.slice(1)}`;

const isKpi = (r: ReportResult) => r.spec.chart === 'kpi';
const showTotal = (r: ReportResult) => r.rows.length > 0 && !isKpi(r) && r.spec.metric !== 'ticket_promedio';
const engineLabel = (r: ReportResult) => (r.engine === 'LLM' ? 'Interpretado por IA' : 'Intérprete local');
const generatedLabel = (r: ReportResult) => new Date(r.generatedAt).toLocaleString('es-BO');
const dateLabel = (r: ReportResult) => new Date(r.generatedAt).toISOString().slice(0, 10);
const periodLabel = (r: ReportResult) => {
  const f = r.spec.filters;
  return f.dateFrom ? `${String(f.dateFrom)} a ${String(f.dateTo ?? 'hoy')}` : 'Todo el período';
};

/** Filas de la tabla de contexto (solo los datos que existen en el reporte). */
export const contextRows = (r: ReportResult, meta: ExportMeta): [string, string][] => {
  const f = r.spec.filters;
  const rows: [string, string][] = [
    ['Empresa', meta.companyName || '—'],
    ['Reporte', r.spec.title],
    ['Solicitud', r.question],
    ['Período', periodLabel(r)],
    ['Sucursal', r.branchName || 'Todas las autorizadas'],
  ];
  if (f.channel) rows.push(['Canal', String(f.channel)]);
  if (f.category) rows.push(['Categoría', String(f.category)]);
  rows.push(['Agrupación', r.spec.dimension !== 'ninguna' ? r.columns[0] : 'Sin agrupar']);
  rows.push(['Métrica', r.columns[1]]);
  rows.push(['Origen del análisis', engineLabel(r)]);
  if (meta.userName) rows.push(['Generado por', meta.userName]);
  return rows;
};

const baseFileName = (r: ReportResult) => {
  const slug = r.spec.title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${slug || 'reporte'}-${dateLabel(r)}`;
};

// ─── EXCEL ────────────────────────────────────────────────────────────────────

export const buildExcel = async (r: ReportResult, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS, meta: ExportMeta = {}): Promise<Blob> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.companyName || 'Reportes con IA';
  wb.created = new Date(r.generatedAt);

  const ws = wb.addWorksheet('Reporte', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 24;

  let row = 1;
  const line = (text: string, style: Partial<ExcelJS.Font>, height?: number) => {
    const cell = ws.getCell(`A${row}`);
    cell.value = text;
    cell.font = style;
    cell.alignment = { vertical: 'middle', wrapText: true };
    ws.mergeCells(`A${row}:B${row}`);
    if (height) ws.getRow(row).height = height;
    row++;
  };

  if (opts.header) {
    line((meta.companyName || '').toUpperCase(), { size: 9, color: { argb: argb(MUTED) } });
  }
  line(r.spec.title, { size: 18, color: { argb: argb(BURGUNDY) } }, 30);
  if (opts.header) {
    line(`Generado: ${generatedLabel(r)}${meta.userName ? `  |  Por: ${meta.userName}` : ''}`, { size: 9, color: { argb: argb(MUTED) } });
  }
  row++;

  if (opts.context) {
    for (const [k, v] of contextRows(r, meta)) {
      ws.getCell(`A${row}`).value = k;
      ws.getCell(`A${row}`).font = { bold: true, color: { argb: argb(TEXT) } };
      ws.getCell(`B${row}`).value = v;
      ws.getCell(`B${row}`).alignment = { wrapText: true, vertical: 'middle' };
      ws.getCell(`B${row}`).font = { color: { argb: argb(TEXT) } };
      ws.getRow(row).height = 18;
      ['A', 'B'].forEach((c) => { ws.getCell(`${c}${row}`).border = { bottom: { style: 'thin', color: { argb: argb(RULE) } } }; });
      row++;
    }
    row++;
  }

  if (opts.narrative && r.narrative) {
    const cell = ws.getCell(`A${row}`);
    cell.value = r.narrative;
    cell.font = { size: 11, color: { argb: argb(TEXT) } };
    cell.alignment = { wrapText: true, vertical: 'middle', indent: 1 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(ZEBRA) } };
    cell.border = { left: { style: 'thick', color: { argb: argb(BURGUNDY) } } };
    ws.mergeCells(`A${row}:B${row}`);
    ws.getRow(row).height = 46;
    row += 2;
  }

  if (r.rows.length === 0) {
    line('Sin datos para los filtros interpretados.', { color: { argb: argb(MUTED) } });
  } else if (isKpi(r)) {
    ws.getCell(`A${row}`).value = r.columns[1];
    ws.getCell(`A${row}`).font = { size: 12, color: { argb: argb(MUTED) } };
    ws.getCell(`B${row}`).value = r.rows[0].value;
    ws.getCell(`B${row}`).numFmt = NUMBER_FORMAT;
    ws.getCell(`B${row}`).font = { size: 24, bold: true, color: { argb: argb(BURGUNDY) } };
    ws.getCell(`B${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(row).height = 40;
    row++;
  } else if (opts.table) {
    const header = ws.getRow(row);
    header.values = [r.columns[0], r.columns[1]];
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.height = 22;
    header.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BURGUNDY) } };
      cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'right' : 'left' };
    });
    const firstData = row + 1;
    r.rows.forEach((item, i) => {
      const dataRow = ws.getRow(firstData + i);
      dataRow.getCell(1).value = item.label;
      dataRow.getCell(2).value = item.value;
      dataRow.getCell(2).numFmt = NUMBER_FORMAT;
      dataRow.getCell(2).alignment = { horizontal: 'right' };
      dataRow.eachCell((cell) => {
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(ZEBRA) } };
        cell.border = { bottom: { style: 'hair', color: { argb: argb(RULE) } } };
      });
    });
    row = firstData + r.rows.length;
    if (opts.total && showTotal(r)) {
      const totalRow = ws.getRow(row);
      totalRow.getCell(1).value = 'Total';
      totalRow.getCell(2).value = { formula: `SUM(B${firstData}:B${row - 1})`, result: r.total };
      totalRow.getCell(2).numFmt = NUMBER_FORMAT;
      totalRow.getCell(2).alignment = { horizontal: 'right' };
      totalRow.font = { bold: true, color: { argb: argb(BURGUNDY) } };
      totalRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: argb(BURGUNDY) } } };
      });
    }
  } else if (opts.total && showTotal(r)) {
    line(`Total: ${fmt(r.total)}`, { bold: true, color: { argb: argb(BURGUNDY) } });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

export const buildPdf = (r: ReportResult, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS, meta: ExportMeta = {}): Blob => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = W - 2 * M;
  const BOTTOM = H - 20;
  let y = 0;

  const fill = (hex: string) => doc.setFillColor(...hexToRgb(hex));
  const ink = (hex: string) => doc.setTextColor(...hexToRgb(hex));
  const stroke = (hex: string) => doc.setDrawColor(...hexToRgb(hex));
  const font = (size: number, style: 'normal' | 'bold' = 'normal') => { doc.setFontSize(size); doc.setFont('helvetica', style); };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) { doc.addPage(); y = M; }
  };
  const truncate = (text: string, maxW: number) => {
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
    return t === text ? t : `${t.trimEnd()}...`;
  };
  const shortLabel = (label: string) => (/^\d{4}-\d{2}-\d{2}$/.test(label) ? label.slice(5) : label);

  // Encabezado: empresa, título y línea de generación
  y = M;
  if (opts.header && meta.companyName) {
    ink(MUTED); font(9);
    doc.text(meta.companyName.toUpperCase(), M, y);
    y += 6;
  }
  ink(BURGUNDY); font(20);
  doc.text(truncate(r.spec.title, CW), M, y + 4);
  y += 11;
  if (opts.header) {
    ink(MUTED); font(9);
    doc.text(`Generado: ${generatedLabel(r)}${meta.userName ? `  |  Por: ${meta.userName}` : ''}`, M, y);
    y += 4;
  }
  stroke(BURGUNDY); doc.setLineWidth(0.6);
  doc.line(M, y + 2, W - M, y + 2);
  y += 9;

  // Tabla de filtros y contexto
  if (opts.context) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 20 },
      head: [['Filtro / contexto', 'Valor']],
      body: contextRows(r, meta),
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.2, textColor: hexToRgb(TEXT) },
      headStyles: { fillColor: hexToRgb(BURGUNDY), textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: hexToRgb(ZEBRA) },
      columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' } },
    });
    const ctxTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    y = (ctxTable?.finalY ?? y) + 8;
  }

  // Resumen en texto
  if (opts.narrative && r.narrative) {
    font(10.5);
    const lines = doc.splitTextToSize(r.narrative, CW - 10) as string[];
    const boxH = lines.length * 5 + 7;
    ensure(boxH);
    fill(ZEBRA);
    doc.rect(M, y, CW, boxH, 'F');
    fill(BURGUNDY);
    doc.rect(M, y, 1.4, boxH, 'F');
    ink(TEXT);
    lines.forEach((line, i) => doc.text(line, M + 6, y + 6 + i * 5));
    y += boxH + 8;
  }

  if (r.rows.length === 0) {
    ink(MUTED); font(10);
    doc.text('Sin datos para los filtros interpretados.', M, y + 4);
    y += 10;
  } else if (isKpi(r)) {
    ensure(36);
    ink(MUTED); font(10);
    doc.text(r.columns[1], M, y + 4);
    ink(BURGUNDY); font(30, 'bold');
    doc.text(fmt(r.rows[0].value), M, y + 20);
    y += 30;
  }

  // Gráfico (opcional): barras horizontales o líneas, en granate
  if (opts.chart && r.rows.length > 0 && !isKpi(r)) {
    if (r.spec.chart === 'line') {
      const chartH = 66;
      ensure(chartH);
      const x0 = M + 2;
      const x1 = W - M - 2;
      const top = y + 8;
      const bottom = y + chartH - 10;
      const max = Math.max(...r.rows.map((p) => p.value), 1);
      const n = r.rows.length;
      const xAt = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1));
      const yAt = (v: number) => bottom - (v / max) * (bottom - top);

      stroke('#CCCCCC'); doc.setLineWidth(0.2);
      doc.line(x0, bottom, x1, bottom);
      ink(MUTED); font(7);
      doc.text(`máx ${fmt(max)}`, x0, top - 2);

      stroke(BURGUNDY); doc.setLineWidth(0.6);
      r.rows.forEach((p, i) => {
        if (i > 0) doc.line(xAt(i - 1), yAt(r.rows[i - 1].value), xAt(i), yAt(p.value));
      });
      fill(BURGUNDY);
      r.rows.forEach((p, i) => doc.circle(xAt(i), yAt(p.value), 0.9, 'F'));

      const step = Math.ceil(n / 12);
      ink(MUTED); font(7);
      r.rows.forEach((p, i) => {
        if (i % step === 0) doc.text(shortLabel(p.label), xAt(i), bottom + 4.5, { align: 'center' });
      });
      y += chartH + 4;
    } else {
      const rowH = 7;
      const labelW = 58;
      const barX = M + labelW;
      const barMaxW = CW - labelW - 22;
      const max = Math.max(...r.rows.map((p) => p.value), 1);
      r.rows.forEach((p) => {
        ensure(rowH);
        ink(TEXT); font(8.5);
        doc.text(truncate(p.label, labelW - 3), M, y + 3.6);
        fill(TRACK);
        doc.rect(barX, y, barMaxW, 4.2, 'F');
        fill(BURGUNDY);
        doc.rect(barX, y, Math.max(0, (p.value / max) * barMaxW), 4.2, 'F');
        ink(TEXT);
        doc.text(fmt(p.value), barX + barMaxW + 2, y + 3.6);
        y += rowH;
      });
      y += 4;
    }
  }

  // Tabla de datos (+ total)
  if (opts.table && r.rows.length > 0 && !isKpi(r)) {
    ensure(20);
    ink(BURGUNDY); font(11, 'bold');
    doc.text('Detalle', M, y + 4);
    y += 7;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 20 },
      head: [[r.columns[0], r.columns[1]]],
      body: r.rows.map((p) => [p.label, fmt(p.value)]),
      foot: opts.total && showTotal(r) ? [['Total', fmt(r.total)]] : undefined,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.4, textColor: hexToRgb(TEXT), lineColor: hexToRgb(RULE), lineWidth: { bottom: 0.1 } },
      headStyles: { fillColor: hexToRgb(BURGUNDY), textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: hexToRgb(ZEBRA) },
      footStyles: { fillColor: hexToRgb('#FFFFFF'), textColor: hexToRgb(BURGUNDY), fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.column.index === 1) data.cell.styles.halign = 'right';
      },
    });
    const dataTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    y = (dataTable?.finalY ?? y) + 8;
  } else if (opts.total && showTotal(r)) {
    ensure(10);
    ink(BURGUNDY); font(10, 'bold');
    doc.text(`Total: ${fmt(r.total)}`, M, y + 4);
    y += 10;
  }

  // Pie de página
  if (opts.footer) {
    const pages = doc.getNumberOfPages();
    const footerLeft = [meta.companyName, r.spec.title, generatedLabel(r)].filter(Boolean).join(' | ');
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      ink(MUTED); font(8);
      doc.text(truncate(footerLeft, CW - 30), M, H - 10);
      doc.text(`Página ${p} de ${pages}`, W - M, H - 10, { align: 'right' });
    }
  }

  return doc.output('blob');
};

// ─── DESCARGA ─────────────────────────────────────────────────────────────────

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportReportExcel = async (r: ReportResult, opts: ExportOptions, meta: ExportMeta) => {
  saveBlob(await buildExcel(r, opts, meta), `${baseFileName(r)}.xlsx`);
};

export const exportReportPdf = (r: ReportResult, opts: ExportOptions, meta: ExportMeta) => {
  saveBlob(buildPdf(r, opts, meta), `${baseFileName(r)}.pdf`);
};
