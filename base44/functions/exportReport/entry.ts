import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import ExcelJS from 'npm:exceljs@4.4.0';
import { jsPDF } from 'npm:jspdf@2.5.1';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

function toCSV(rows, columns) {
  if (!rows?.length) return '';
  const cols = columns || Object.keys(rows[0]);
  const header = cols.join(',');
  const lines = rows.map(row =>
    cols.map(col => {
      const val = row[col] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

async function buildXLSX(result) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM Sistema';
  workbook.created = new Date();

  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Value', key: 'value', width: 30 }
  ];
  summarySheet.getRow(1).font = { bold: true };

  const summary = result.summary || {};
  for (const [k, v] of Object.entries(summary)) {
    if (typeof v === 'object' && v !== null) {
      for (const [sk, sv] of Object.entries(v)) {
        summarySheet.addRow({ metric: `${k} / ${sk}`, value: sv });
      }
    } else {
      summarySheet.addRow({ metric: k, value: v });
    }
  }

  // Sheet 2: Data
  const rows = result.rows || [];
  if (rows.length) {
    const dataSheet = workbook.addWorksheet('Data');
    const cols = Object.keys(rows[0]);
    dataSheet.columns = cols.map(c => ({ header: c, key: c, width: Math.max(c.length + 4, 16) }));
    dataSheet.getRow(1).font = { bold: true };
    rows.forEach(row => dataSheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function buildPDF(result) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const addText = (text, size = 10, style = 'normal', color = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), maxWidth);
    lines.forEach(line => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += size * 0.45;
    });
    y += 2;
  };

  const addLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  // Header
  addText(`${(result.type || 'Report').toUpperCase()} REPORT`, 18, 'bold', [20, 40, 80]);
  addText(`Sugeneruota: ${new Date().toLocaleString('lt-LT')}`, 9, 'normal', [100, 100, 100]);
  y += 4;
  addLine();

  // Summary
  addText('SUVESTINĖ', 12, 'bold', [20, 40, 80]);
  const summary = result.summary || {};
  for (const [k, v] of Object.entries(summary)) {
    if (typeof v === 'object' && v !== null) {
      addText(`${k}:`, 10, 'bold');
      for (const [sk, sv] of Object.entries(v)) {
        addText(`    ${sk}: ${sv}`, 9);
      }
    } else {
      addText(`${k}: ${v}`, 10);
    }
  }
  y += 4;
  addLine();

  // Data table (first 200 rows)
  const rows = result.rows || [];
  addText(`DUOMENYS (${rows.length} eilučių${rows.length > 200 ? ', rodoma 200' : ''})`, 12, 'bold', [20, 40, 80]);
  y += 2;

  if (rows.length) {
    const cols = Object.keys(rows[0]);
    const colWidth = Math.min(maxWidth / cols.length, 40);

    // Table header
    doc.setFillColor(240, 243, 250);
    doc.rect(margin, y - 4, maxWidth, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 80);
    cols.forEach((col, i) => {
      const cellText = doc.splitTextToSize(col, colWidth - 2)[0];
      doc.text(cellText, margin + i * colWidth, y);
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);

    rows.slice(0, 200).forEach((row, ri) => {
      if (y > 278) { doc.addPage(); y = 20; }
      if (ri % 2 === 0) {
        doc.setFillColor(250, 251, 255);
        doc.rect(margin, y - 4, maxWidth, 6, 'F');
      }
      cols.forEach((col, i) => {
        const cellText = doc.splitTextToSize(String(row[col] ?? ''), colWidth - 2)[0];
        doc.text(cellText, margin + i * colWidth, y);
      });
      y += 6;
    });

    if (rows.length > 200) {
      y += 4;
      addText(`... ir dar ${rows.length - 200} eilučių`, 9, 'italic', [120, 120, 120]);
    }
  }

  return doc.output('arraybuffer');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT', 'PROJECT_DEVELOPER'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { reportDefinitionId, format, filters: overrideFilters } = await req.json();
    if (!reportDefinitionId) return Response.json({ error: 'reportDefinitionId required' }, { status: 400 });
    if (!['csv', 'xlsx', 'pdf'].includes(format)) return Response.json({ error: 'format must be csv, xlsx, or pdf' }, { status: 400 });

    // 1. Generate report data
    const genResponse = await base44.functions.invoke('generateReport', { reportDefinitionId, filters: overrideFilters });
    const genData = genResponse?.data;
    if (!genData?.success) {
      return Response.json({ error: genData?.error || 'Report generation failed' }, { status: 500 });
    }
    const result = genData.result;
    const rows = result.rows || [];

    let fileBlob, mimeType, fileName;
    const ts = new Date().toISOString().slice(0, 10);
    const baseName = `report_${result.type}_${ts}`;

    if (format === 'csv') {
      const csv = toCSV(rows);
      fileBlob = new Blob([csv], { type: 'text/csv' });
      mimeType = 'text/csv';
      fileName = `${baseName}.csv`;

    } else if (format === 'xlsx') {
      const buffer = await buildXLSX(result);
      fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = `${baseName}.xlsx`;

    } else if (format === 'pdf') {
      const buffer = buildPDF(result);
      fileBlob = new Blob([buffer], { type: 'application/pdf' });
      mimeType = 'application/pdf';
      fileName = `${baseName}.pdf`;
    }

    // 2. Upload file
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: fileBlob });
    const fileUrl = uploadResult?.file_url;
    if (!fileUrl) return Response.json({ error: 'File upload failed' }, { status: 500 });

    // 3. Save as FileAsset
    const fileAsset = await base44.asServiceRole.entities.FileAsset.create({
      fileName,
      originalFileName: fileName,
      mimeType,
      fileUrl,
      assetType: 'document',
      visibility: 'internal',
      status: 'active',
      category: 'other',
      title: `${result.type} report export ${ts}`,
      description: `Auto-generated ${format.toUpperCase()} export`,
      uploadedByUserId: user.id,
      uploadedByName: user.full_name
    });

    // 4. Save execution record
    const execution = await base44.asServiceRole.entities.ReportExecution.create({
      reportDefinitionId,
      executedByUserId: user.id,
      executedAt: new Date().toISOString(),
      status: 'completed',
      reportType: result.type,
      format,
      resultFileAssetId: fileAsset.id,
      filtersApplied: JSON.stringify(overrideFilters || {}),
      rowCount: rows.length
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'REPORT_EXPORTED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ reportDefinitionId, format, rowCount: rows.length, fileAssetId: fileAsset.id })
    });

    return Response.json({ success: true, executionId: execution.id, fileUrl, fileAssetId: fileAsset.id, fileName, format, rowCount: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});