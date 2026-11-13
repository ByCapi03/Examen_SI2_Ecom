/**
 * EXPORTACIÓN DE REPORTES — PDF, Excel y CSV, en el color de la empresa.
 *
 * Todo parte de un ExportDoc (título, contexto, resumen y una tabla de N columnas), así sirve igual para los
 * reportes con IA (simples y cruzados) y para la pantalla Reportes. El usuario elige qué secciones incluir
 * (ExportOptions). Las librerías (ExcelJS, jsPDF) se cargan con import() dinámico desde las páginas.
 */
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DEFAULT_EXPORT_OPTIONS, type ExportDoc, type ExportFormat, type ExportMeta, type ExportOptions, type ReportResult,
} from './exportOptions';
import { DEFAULT_COMPANY_COLOR, hexToRgb, isHex, readableOn, tint } from '../../theme/companyColor';

export type { ExportDoc, ExportFormat, ExportMeta, ExportOptions, ReportResult } from './exportOptions';
export { DEFAULT_EXPORT_OPTIONS, EXPORT_OPTION_LABELS } from './exportOptions';

const TEXT = '#333333';
const MUTED = '#666666';
const RULE = '#DDDDDD';
const NUMBER_FORMAT = '#,##0.00';

const fmt = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 });
const argb = (hex: string) => `FF${hex.slice(1)}`;
const brandOf = (meta: ExportMeta) => (isHex(meta.color) ? meta.color : DEFAULT_COMPANY_COLOR);
const generatedLabel = (d: ExportDoc) => new Date(d.generatedAt).toLocaleString('es-BO');
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const colLetter = (n: number) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

// ─── DOCUMENTO A PARTIR DE UN REPORTE CON IA ─────────────────────────────────────

const periodLabel = (r: ReportResult) => {
  const f = r.spec.filters;
  return f.dateFrom ? `${String(f.dateFrom)} a ${String(f.dateTo ?? 'hoy')}` : 'Todo el período';
};
const engineLabel = (r: ReportResult) => (r.engine === 'LLM' || r.engine === 'LLM_LOCAL' ? 'Interpretado por IA' : 'Intérprete local');

export const reportToDoc = (r: ReportResult, meta: ExportMeta = {}): ExportDoc => {
  const f = r.spec.filters;
  const metricLabel = r.metricLabel ?? r.columns[1];
  const grouping = r.pivot
    ? `${r.pivot.rowLabel} × ${r.pivot.columnLabel}`
    : r.spec.dimension !== 'ninguna' ? r.columns[0] : 'Sin agrupar';
  const context: [string, string][] = [
    ['Empresa', meta.companyName || '—'],
    ['Reporte', r.spec.title],
    ['Solicitud', r.question],
    ['Período', periodLabel(r)],
    ['Sucursal', r.branchName || 'Todas las autorizadas'],
  ];
  if (f.channel) context.push(['Canal', String(f.channel)]);
  if (f.category) context.push(['Categoría', String(f.category)]);
  context.push(['Agrupación', grouping]);
  context.push(['Métrica', metricLabel]);
  context.push(['Origen del análisis', engineLabel(r)]);
  if (meta.userName) context.push(['Generado por', meta.userName]);

  const doc: ExportDoc = {
    title: r.spec.title,
    generatedAt: r.generatedAt,
    context,
    narrative: r.narrative,
    fileName: '',
    origin: engineLabel(r),
  };
  const stamp = new Date(r.generatedAt).toISOString().slice(0, 10);
  const slug = r.spec.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  doc.fileName = `${slug || 'reporte'}-${stamp}`;

  if (r.rows.length === 0) return doc;
  if (r.spec.chart === 'kpi') {
    doc.kpi = { label: metricLabel, value: r.rows[0].value };
    return doc;
  }
  if (r.pivot) {
    const p = r.pivot;
    doc.table = {
      columns: [p.rowLabel, ...p.series, 'Total'],
      rows: p.rows.map((row) => [row.label, ...row.cells, row.total]),
      totals: ['Total', ...(p.columnTotals ?? p.series.map(() => null)), p.grandTotal],
    };
  } else {
    doc.table = {
      columns: [r.columns[0], r.columns[1]],
      rows: r.rows.map((x) => [x.label, x.value]),
      totals: r.spec.metric !== 'ticket_promedio' ? ['Total', r.total] : undefined,
    };
    doc.chart = { kind: r.spec.chart === 'line' ? 'line' : 'bar', rows: r.rows };
  }
  return doc;
};

// ─── CSV ─────────────────────────────────────────────────────────────────────────

export const buildCsv = (doc: ExportDoc): Blob => {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines: (string | number | null)[][] = [];
  if (doc.table) {
    lines.push(doc.table.columns, ...doc.table.rows);
    if (doc.table.totals) lines.push(doc.table.totals.map((v) => (v === null ? '' : v)));
  } else if (doc.kpi) {
    lines.push([doc.kpi.label], [doc.kpi.value]);
  }
  return new Blob(['﻿' + lines.map((l) => l.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
};

// ─── EXCEL ───────────────────────────────────────────────────────────────────────

export const buildExcel = async (doc: ExportDoc, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS, meta: ExportMeta = {}): Promise<Blob> => {
  const BRAND = brandOf(meta);
  const ON = readableOn(BRAND);
  const SOFT = tint(BRAND, 0.9);
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.companyName || 'Reportes';
  wb.created = new Date(doc.generatedAt);

  const nCols = Math.max(doc.table?.columns.length ?? 2, 2);
  const lastCol = colLetter(nCols);
  const ws = wb.addWorksheet('Reporte', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: nCols > 5 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getColumn(1).width = 34;
  for (let c = 2; c <= nCols; c++) ws.getColumn(c).width = nCols > 4 ? 16 : 24;

  let row = 1;
  const line = (text: string, style: Partial<ExcelJS.Font>, height?: number) => {
    const cell = ws.getCell(`A${row}`);
    cell.value = text;
    cell.font = style;
    cell.alignment = { vertical: 'middle', wrapText: true };
    ws.mergeCells(`A${row}:${lastCol}${row}`);
    if (height) ws.getRow(row).height = height;
    row++;
  };

  if (opts.header && meta.companyName) line(meta.companyName.toUpperCase(), { size: 9, color: { argb: argb(MUTED) } });
  line(doc.title, { size: 18, bold: true, color: { argb: argb(BRAND) } }, 30);
  if (opts.header) line(`Generado: ${generatedLabel(doc)}${meta.userName ? `  |  Por: ${meta.userName}` : ''}`, { size: 9, color: { argb: argb(MUTED) } });
  row++;

  if (opts.context && doc.context.length) {
    for (const [k, v] of doc.context) {
      ws.getCell(`A${row}`).value = k;
      ws.getCell(`A${row}`).font = { bold: true, color: { argb: argb(TEXT) } };
      ws.getCell(`B${row}`).value = v;
      ws.getCell(`B${row}`).alignment = { wrapText: true, vertical: 'middle' };
      ws.getCell(`B${row}`).font = { color: { argb: argb(TEXT) } };
      ws.mergeCells(`B${row}:${lastCol}${row}`);
      ws.getRow(row).height = 18;
      for (let c = 1; c <= nCols; c++) ws.getCell(`${colLetter(c)}${row}`).border = { bottom: { style: 'thin', color: { argb: argb(RULE) } } };
      row++;
    }
    row++;
  }

  if (opts.narrative && doc.narrative) {
    const cell = ws.getCell(`A${row}`);
    cell.value = doc.narrative;
    cell.font = { size: 11, color: { argb: argb(TEXT) } };
    cell.alignment = { wrapText: true, vertical: 'middle', indent: 1 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(SOFT) } };
    cell.border = { left: { style: 'thick', color: { argb: argb(BRAND) } } };
    ws.mergeCells(`A${row}:${lastCol}${row}`);
    ws.getRow(row).height = 46;
    row += 2;
  }

  if (doc.kpi) {
    ws.getCell(`A${row}`).value = doc.kpi.label;
    ws.getCell(`A${row}`).font = { size: 12, color: { argb: argb(MUTED) } };
    ws.getCell(`B${row}`).value = doc.kpi.value;
    ws.getCell(`B${row}`).numFmt = NUMBER_FORMAT;
    ws.getCell(`B${row}`).font = { size: 24, bold: true, color: { argb: argb(BRAND) } };
    ws.getCell(`B${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(row).height = 40;
    row++;
  } else if (opts.table && doc.table) {
    const t = doc.table;
    const header = ws.getRow(row);
    header.values = t.columns;
    header.height = 24;
    header.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: argb(ON) } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND) } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right', wrapText: true };
    });
    const headerRow = row;
    const firstData = row + 1;
    t.rows.forEach((values, i) => {
      const dataRow = ws.getRow(firstData + i);
      values.forEach((v, c) => {
        const cell = dataRow.getCell(c + 1);
        cell.value = v;
        if (c > 0) { cell.numFmt = NUMBER_FORMAT; cell.alignment = { horizontal: 'right' }; }
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(SOFT) } };
        cell.border = { bottom: { style: 'hair', color: { argb: argb(RULE) } } };
      });
    });
    row = firstData + t.rows.length;
    if (opts.total && t.totals) {
      const totalRow = ws.getRow(row);
      t.totals.forEach((v, c) => {
        const cell = totalRow.getCell(c + 1);
        if (c === 0) cell.value = String(v ?? 'Total');
        else if (isNum(v) && t.rows.length) {
          const L = colLetter(c + 1);
          cell.value = { formula: `SUM(${L}${firstData}:${L}${row - 1})`, result: v };
          cell.numFmt = NUMBER_FORMAT;
        } else cell.value = '—';
        cell.alignment = { horizontal: c === 0 ? 'left' : 'right' };
        cell.font = { bold: true, color: { argb: argb(BRAND) } };
        cell.border = { top: { style: 'medium', color: { argb: argb(BRAND) } } };
      });
      row++;
    }
    // Cabecera fija y filtros, para trabajar los datos en Excel
    ws.views = [{ showGridLines: false, state: 'frozen', ySplit: headerRow }];
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + t.rows.length, column: t.columns.length } };
  } else if (!doc.table) {
    line('Sin datos para los filtros interpretados.', { color: { argb: argb(MUTED) } });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// ─── PDF ─────────────────────────────────────────────────────────────────────────

export const buildPdf = (docData: ExportDoc, opts: ExportOptions = DEFAULT_EXPORT_OPTIONS, meta: ExportMeta = {}): Blob => {
  const BRAND = brandOf(meta);
  const ON = readableOn(BRAND);
  const SOFT = tint(BRAND, 0.9);
  const TRACK = tint(BRAND, 0.85);
  const wide = (docData.table?.columns.length ?? 0) > 6;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: wide ? 'landscape' : 'portrait' });
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
  const ensure = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };
  const truncate = (text: string, maxW: number) => {
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
    return t === text ? t : `${t.trimEnd()}...`;
  };
  const shortLabel = (label: string) => (/^\d{4}-\d{2}-\d{2}$/.test(label) ? label.slice(5) : label);
  const lastTable = () => (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;

  // Encabezado
  y = M;
  if (opts.header && meta.companyName) { ink(MUTED); font(9); doc.text(meta.companyName.toUpperCase(), M, y); y += 6; }
  ink(BRAND); font(20);
  doc.text(truncate(docData.title, CW), M, y + 4);
  y += 11;
  if (opts.header) {
    ink(MUTED); font(9);
    doc.text(`Generado: ${generatedLabel(docData)}${meta.userName ? `  |  Por: ${meta.userName}` : ''}`, M, y);
    y += 4;
  }
  stroke(BRAND); doc.setLineWidth(0.6);
  doc.line(M, y + 2, W - M, y + 2);
  y += 9;

  // Filtros y contexto
  if (opts.context && docData.context.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 20 },
      head: [['Filtro / contexto', 'Valor']],
      body: docData.context,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.2, textColor: hexToRgb(TEXT) },
      headStyles: { fillColor: hexToRgb(BRAND), textColor: hexToRgb(ON), fontStyle: 'bold' },
      alternateRowStyles: { fillColor: hexToRgb(SOFT) },
      columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' } },
    });
    y = (lastTable()?.finalY ?? y) + 8;
  }

  // Resumen en texto
  if (opts.narrative && docData.narrative) {
    font(10.5);
    const lines = doc.splitTextToSize(docData.narrative, CW - 10) as string[];
    const boxH = lines.length * 5 + 7;
    ensure(boxH);
    fill(SOFT); doc.rect(M, y, CW, boxH, 'F');
    fill(BRAND); doc.rect(M, y, 1.4, boxH, 'F');
    ink(TEXT);
    lines.forEach((l, i) => doc.text(l, M + 6, y + 6 + i * 5));
    y += boxH + 8;
  }

  if (!docData.table && !docData.kpi) {
    ink(MUTED); font(10);
    doc.text('Sin datos para los filtros interpretados.', M, y + 4);
    y += 10;
  } else if (docData.kpi) {
    ensure(36);
    ink(MUTED); font(10);
    doc.text(docData.kpi.label, M, y + 4);
    ink(BRAND); font(30, 'bold');
    doc.text(fmt(docData.kpi.value), M, y + 20);
    y += 30;
  }

  // Gráfico (opcional, solo reportes simples)
  const chart = docData.chart;
  if (opts.chart && chart && chart.rows.length > 0) {
    if (chart.kind === 'line') {
      const chartH = 66;
      ensure(chartH);
      const x0 = M + 2, x1 = W - M - 2, top = y + 8, bottom = y + chartH - 10;
      const max = Math.max(...chart.rows.map((p) => p.value), 1);
      const n = chart.rows.length;
      const xAt = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1));
      const yAt = (v: number) => bottom - (v / max) * (bottom - top);
      stroke('#CCCCCC'); doc.setLineWidth(0.2); doc.line(x0, bottom, x1, bottom);
      ink(MUTED); font(7); doc.text(`máx ${fmt(max)}`, x0, top - 2);
      stroke(BRAND); doc.setLineWidth(0.6);
      chart.rows.forEach((p, i) => { if (i > 0) doc.line(xAt(i - 1), yAt(chart.rows[i - 1].value), xAt(i), yAt(p.value)); });
      fill(BRAND);
      chart.rows.forEach((p, i) => doc.circle(xAt(i), yAt(p.value), 0.9, 'F'));
      const step = Math.ceil(n / 12);
      ink(MUTED); font(7);
      chart.rows.forEach((p, i) => { if (i % step === 0) doc.text(shortLabel(p.label), xAt(i), bottom + 4.5, { align: 'center' }); });
      y += chartH + 4;
    } else {
      const rowH = 7, labelW = 58, barX = M + labelW, barMaxW = CW - labelW - 22;
      const max = Math.max(...chart.rows.map((p) => p.value), 1);
      chart.rows.forEach((p) => {
        ensure(rowH);
        ink(TEXT); font(8.5);
        doc.text(truncate(p.label, labelW - 3), M, y + 3.6);
        fill(TRACK); doc.rect(barX, y, barMaxW, 4.2, 'F');
        fill(BRAND); doc.rect(barX, y, Math.max(0, (p.value / max) * barMaxW), 4.2, 'F');
        ink(TEXT); doc.text(fmt(p.value), barX + barMaxW + 2, y + 3.6);
        y += rowH;
      });
      y += 4;
    }
  }

  // Tabla de datos (+ totales)
  if (opts.table && docData.table) {
    const t = docData.table;
    ensure(20);
    ink(BRAND); font(11, 'bold');
    doc.text('Detalle', M, y + 4);
    y += 7;
    const size = t.columns.length > 9 ? 7 : t.columns.length > 5 ? 8 : 9;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 20 },
      head: [t.columns],
      body: t.rows.map((r) => r.map((v, c) => (c > 0 && isNum(v) ? fmt(v) : String(v)))),
      foot: opts.total && t.totals ? [t.totals.map((v, c) => (c === 0 ? String(v ?? 'Total') : isNum(v) ? fmt(v) : '—'))] : undefined,
      theme: 'plain',
      styles: { fontSize: size, cellPadding: 2.4, textColor: hexToRgb(TEXT), lineColor: hexToRgb(RULE), lineWidth: { bottom: 0.1 } },
      headStyles: { fillColor: hexToRgb(BRAND), textColor: hexToRgb(ON), fontStyle: 'bold' },
      alternateRowStyles: { fillColor: hexToRgb(SOFT) },
      footStyles: { fillColor: hexToRgb('#FFFFFF'), textColor: hexToRgb(BRAND), fontStyle: 'bold' },
      didParseCell: (data) => { if (data.column.index > 0) data.cell.styles.halign = 'right'; },
    });
    y = (lastTable()?.finalY ?? y) + 8;
  }

  // Pie de página
  if (opts.footer) {
    const pages = doc.getNumberOfPages();
    const footerLeft = [meta.companyName, docData.title, generatedLabel(docData)].filter(Boolean).join(' | ');
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      ink(MUTED); font(8);
      doc.text(truncate(footerLeft, CW - 30), M, H - 10);
      doc.text(`Página ${p} de ${pages}`, W - M, H - 10, { align: 'right' });
    }
  }
  return doc.output('blob');
};

// ─── DESCARGA ────────────────────────────────────────────────────────────────────

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

/** Descarga el documento en el formato elegido. */
export const exportDocument = async (doc: ExportDoc, format: ExportFormat, opts: ExportOptions, meta: ExportMeta) => {
  if (format === 'excel') saveBlob(await buildExcel(doc, opts, meta), `${doc.fileName}.xlsx`);
  else if (format === 'pdf') saveBlob(buildPdf(doc, opts, meta), `${doc.fileName}.pdf`);
  else saveBlob(buildCsv(doc), `${doc.fileName}.csv`);
};

export const exportReport = (r: ReportResult, format: ExportFormat, opts: ExportOptions, meta: ExportMeta) =>
  exportDocument(reportToDoc(r, meta), format, opts, meta);
