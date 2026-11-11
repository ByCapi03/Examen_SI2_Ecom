/**
 * EXPORTACIÓN DE REPORTES CON IA — Excel (.xlsx) y PDF.
 *
 * Replica el formato que el usuario ve en pantalla: título, período y filtros,
 * motor, pregunta, narrativa, KPI o gráfico y tabla de datos con su total.
 * Las librerías (ExcelJS, jsPDF) se cargan desde AiReportsPage con import()
 * dinámico para no engordar la carga inicial de la página.
 */
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

// Paleta de la marca (mismos tokens que --atemporal-* en global.css)
const GREEN = '#182D2A';
const GOLD = '#C9904A';
const MUTED = '#837A6D';
const TEXT = '#1D2926';
const PAPER = '#F5F2EB';
const TRACK = '#EEEAE1';
const ZEBRA = '#F9F7F2';
const NUMBER_FORMAT = '#,##0.00';

const fmt = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 });
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const argb = (hex: string) => `FF${hex.slice(1)}`;

const isKpi = (r: ReportResult) => r.spec.chart === 'kpi';
const showTotal = (r: ReportResult) => !isKpi(r) && r.rows.length > 0 && r.spec.metric !== 'ticket_promedio';
const engineLabel = (r: ReportResult) => (r.engine === 'LLM' ? 'Interpretado por IA' : 'Intérprete local');
const generatedLabel = (r: ReportResult) => new Date(r.generatedAt).toLocaleString('es-BO');
const dateLabel = (r: ReportResult) => new Date(r.generatedAt).toISOString().slice(0, 10);

/** Línea de contexto: métrica, período, sucursal y filtros (igual que en pantalla). */
export const reportSubtitle = (r: ReportResult): string => {
  const f = r.spec.filters;
  const parts = [`${r.columns[1]}${r.spec.dimension !== 'ninguna' ? ` por ${r.columns[0].toLowerCase()}` : ''}`];
  parts.push(f.dateFrom ? `${f.dateFrom} a ${f.dateTo ?? 'hoy'}` : 'todo el período');
  if (r.branchName) parts.push(r.branchName);
  if (f.category) parts.push(`categoría ${f.category}`);
  if (f.channel) parts.push(`canal ${f.channel}`);
  return parts.join(' · ');
};

const baseFileName = (r: ReportResult) => {
  const slug = r.spec.title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${slug || 'reporte'}-${dateLabel(r)}`;
};

// ─── EXCEL ────────────────────────────────────────────────────────────────────

export const buildExcel = async (r: ReportResult): Promise<Blob> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reportes con IA';
  wb.created = new Date(r.generatedAt);

  const ws = wb.addWorksheet('Reporte', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getColumn(1).width = 44;
  ws.getColumn(2).width = 22;

  const mergeRow = (row: number) => ws.mergeCells(`A${row}:B${row}`);

  // Título
  ws.getCell('A1').value = r.spec.title;
  ws.getCell('A1').font = { size: 16, bold: true, color: { argb: argb(GREEN) } };
  ws.getCell('A1').alignment = { vertical: 'middle' };
  ws.getRow(1).height = 30;
  mergeRow(1);

  // Contexto
  ws.getCell('A2').value = reportSubtitle(r);
  ws.getCell('A2').font = { size: 10, color: { argb: argb(MUTED) } };
  mergeRow(2);
  ws.getCell('A3').value = `Motor: ${engineLabel(r)}  ·  Generado: ${generatedLabel(r)}`;
  ws.getCell('A3').font = { size: 9, color: { argb: argb(MUTED) } };
  mergeRow(3);
  ws.getCell('A4').value = `Pregunta: ${r.question}`;
  ws.getCell('A4').font = { size: 9, italic: true, color: { argb: argb(MUTED) } };
  ws.getCell('A4').alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(4).height = 26;
  mergeRow(4);

  // Narrativa destacada
  ws.getCell('A6').value = r.narrative;
  ws.getCell('A6').font = { size: 11, color: { argb: argb(TEXT) } };
  ws.getCell('A6').alignment = { wrapText: true, vertical: 'middle', indent: 1 };
  ws.getCell('A6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PAPER) } };
  ws.getCell('A6').border = { left: { style: 'thick', color: { argb: argb(GOLD) } } };
  ws.getRow(6).height = 48;
  mergeRow(6);

  let row = 8;
  if (r.rows.length === 0) {
    ws.getCell(`A${row}`).value = 'Sin datos para los filtros interpretados.';
    ws.getCell(`A${row}`).font = { color: { argb: argb(MUTED) } };
    mergeRow(row);
  } else if (isKpi(r)) {
    ws.getCell(`A${row}`).value = r.columns[1];
    ws.getCell(`A${row}`).font = { size: 12, color: { argb: argb(MUTED) } };
    ws.getCell(`B${row}`).value = r.rows[0].value;
    ws.getCell(`B${row}`).numFmt = NUMBER_FORMAT;
    ws.getCell(`B${row}`).font = { size: 26, bold: true, color: { argb: argb(GREEN) } };
    ws.getCell(`B${row}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(row).height = 40;
  } else {
    // Encabezado de tabla
    const header = ws.getRow(row);
    header.values = [r.columns[0], r.columns[1]];
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.height = 22;
    header.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(GREEN) } };
      cell.alignment = { vertical: 'middle', horizontal: col === 2 ? 'right' : 'left' };
    });
    const firstData = row + 1;
    r.rows.forEach((item, i) => {
      const line = ws.getRow(firstData + i);
      line.getCell(1).value = item.label;
      line.getCell(2).value = item.value;
      line.getCell(2).numFmt = NUMBER_FORMAT;
      line.getCell(2).alignment = { horizontal: 'right' };
      line.eachCell((cell) => {
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(ZEBRA) } };
        cell.border = { bottom: { style: 'hair', color: { argb: argb('#CFC1A5') } } };
      });
    });
    row = firstData + r.rows.length;
    if (showTotal(r)) {
      const totalRow = ws.getRow(row);
      const lastData = row - 1;
      totalRow.getCell(1).value = 'Total';
      totalRow.getCell(2).value = { formula: `SUM(B${firstData}:B${lastData})`, result: r.total };
      totalRow.getCell(2).numFmt = NUMBER_FORMAT;
      totalRow.getCell(2).alignment = { horizontal: 'right' };
      totalRow.font = { bold: true, color: { argb: argb(GREEN) } };
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(PAPER) } };
        cell.border = { top: { style: 'thin', color: { argb: argb(GREEN) } } };
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

export const buildPdf = (r: ReportResult): Blob => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;
  const CW = W - 2 * M;
  const BOTTOM = H - 18;
  let y = 0;

  const fill = (hex: string) => doc.setFillColor(...hexToRgb(hex));
  const ink = (hex: string) => doc.setTextColor(...hexToRgb(hex));
  const stroke = (hex: string) => doc.setDrawColor(...hexToRgb(hex));
  const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => { doc.setFontSize(size); doc.setFont('helvetica', style); };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) { doc.addPage(); y = M + 2; }
  };
  const truncate = (text: string, maxW: number) => {
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
    return t === text ? t : `${t.trimEnd()}...`;
  };
  const shortLabel = (label: string) => (/^\d{4}-\d{2}-\d{2}$/.test(label) ? label.slice(5) : label);

  // Banda de encabezado
  fill(GREEN);
  doc.rect(0, 0, W, 34, 'F');
  ink('#FFFFFF');
  font(17, 'bold');
  doc.text(truncate(r.spec.title, CW), M, 15);
  ink(GOLD);
  font(9);
  doc.text(`Reportes con IA · Generado el ${generatedLabel(r)}`, M, 24);
  y = 44;

  // Contexto
  ink(MUTED);
  font(9.5);
  doc.text(doc.splitTextToSize(reportSubtitle(r), CW) as string[], M, y);
  y += 5.5;
  doc.text(`Motor: ${engineLabel(r)}`, M, y);
  y += 5;
  const questionLines = doc.splitTextToSize(`Pregunta: ${r.question}`, CW) as string[];
  doc.text(questionLines, M, y);
  y += questionLines.length * 4.4 + 5;

  // Narrativa
  font(10.5);
  const narrLines = doc.splitTextToSize(r.narrative, CW - 10) as string[];
  const boxH = narrLines.length * 5 + 7;
  ensure(boxH);
  fill(PAPER);
  doc.rect(M, y, CW, boxH, 'F');
  fill(GOLD);
  doc.rect(M, y, 1.4, boxH, 'F');
  ink(TEXT);
  narrLines.forEach((line, i) => doc.text(line, M + 6, y + 6 + i * 5));
  y += boxH + 9;

  if (r.rows.length === 0) {
    ink(MUTED);
    font(10);
    doc.text('Sin datos para los filtros interpretados.', M, y);
  } else if (isKpi(r)) {
    ensure(42);
    ink(MUTED);
    font(10);
    doc.text(r.columns[1], M, y + 4);
    ink(GREEN);
    font(34, 'bold');
    doc.text(fmt(r.rows[0].value), M, y + 22);
    y += 34;
  } else if (r.spec.chart === 'line') {
    // Gráfico de líneas (igual que LineChart en pantalla)
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

    stroke('#CCCCCC');
    doc.setLineWidth(0.2);
    doc.line(x0, bottom, x1, bottom);
    ink(MUTED);
    font(7);
    doc.text(`máx ${fmt(max)}`, x0, top - 2);

    stroke(GREEN);
    doc.setLineWidth(0.6);
    r.rows.forEach((p, i) => {
      if (i > 0) doc.line(xAt(i - 1), yAt(r.rows[i - 1].value), xAt(i), yAt(p.value));
    });
    fill(GOLD);
    r.rows.forEach((p, i) => doc.circle(xAt(i), yAt(p.value), 0.9, 'F'));

    const step = Math.ceil(n / 12);
    ink(MUTED);
    font(7);
    r.rows.forEach((p, i) => {
      if (i % step === 0) doc.text(shortLabel(p.label), xAt(i), bottom + 4.5, { align: 'center' });
    });
    y += chartH + 4;
  } else {
    // Barras horizontales (igual que BarChart en pantalla)
    const rowH = 7;
    const labelW = 58;
    const barX = M + labelW;
    const barMaxW = CW - labelW - 22;
    const max = Math.max(...r.rows.map((p) => p.value), 1);
    r.rows.forEach((p, i) => {
      ensure(rowH);
      ink(TEXT);
      font(8.5);
      doc.text(truncate(p.label, labelW - 3), M, y + 3.6);
      fill(TRACK);
      doc.rect(barX, y, barMaxW, 4.2, 'F');
      fill(i === 0 ? GOLD : GREEN);
      doc.rect(barX, y, Math.max(0, (p.value / max) * barMaxW), 4.2, 'F');
      ink(TEXT);
      doc.text(fmt(p.value), barX + barMaxW + 2, y + 3.6);
      y += rowH;
    });
    y += 4;
  }

  // Tabla de datos (la pagina sola cuando cruza de hoja)
  if (r.rows.length > 0 && !isKpi(r)) {
    if (y > BOTTOM - 20) { doc.addPage(); y = M + 2; }
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 18 },
      head: [[r.columns[0], r.columns[1]]],
      body: r.rows.map((p) => [p.label, fmt(p.value)]),
      foot: showTotal(r) ? [['Total', fmt(r.total)]] : undefined,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2.4, textColor: hexToRgb(TEXT), lineColor: hexToRgb('#CFC1A5'), lineWidth: { bottom: 0.1 } },
      headStyles: { fillColor: hexToRgb(GREEN), textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: hexToRgb(ZEBRA) },
      footStyles: { fillColor: hexToRgb(PAPER), textColor: hexToRgb(GREEN), fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.column.index === 1) data.cell.styles.halign = 'right';
      },
    });
    const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    y = (lastTable?.finalY ?? y) + 8;
  }

  // Pie de página en todas las hojas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    ink(MUTED);
    font(8);
    doc.text(`Generado: ${generatedLabel(r)}`, M, H - 9);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 9, { align: 'right' });
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

export const exportReportExcel = async (r: ReportResult) => {
  saveBlob(await buildExcel(r), `${baseFileName(r)}.xlsx`);
};

export const exportReportPdf = (r: ReportResult) => {
  saveBlob(buildPdf(r), `${baseFileName(r)}.pdf`);
};
