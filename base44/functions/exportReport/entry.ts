import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

function buildPDFText(result) {
  const lines = [];
  const type = result.type?.toUpperCase() || 'REPORT';
  lines.push(`=== ${type} REPORT ===`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('--- SUMMARY ---');
  const summary = result.summary || {};
  for (const [k, v] of Object.entries(summary)) {
    if (typeof v === 'object') {
      lines.push(`${k}:`);
      for (const [sk, sv] of Object.entries(v)) lines.push(`  ${sk}: ${sv}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('');
  lines.push(`--- DATA (${result.rows?.length || 0} rows) ---`);
  if (result.rows?.length) {
    const cols = Object.keys(result.rows[0]);
    lines.push(cols.join(' | '));
    lines.push(cols.map(() => '---').join(' | '));
    result.rows.slice(0, 200).forEach(row => {
      lines.push(cols.map(c => String(row[c] ?? '')).join(' | '));
    });
    if (result.rows.length > 200) lines.push(`... and ${result.rows.length - 200} more rows`);
  }
  return lines.join('\n');
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

    // 1. Generate the report data
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
      // Build a multi-sheet CSV (summary + data) as TSV since we have no xlsx lib
      // We encode as UTF-8 with BOM for Excel compatibility
      const summaryRows = Object.entries(result.summary || {}).map(([k, v]) => ({
        metric: k,
        value: typeof v === 'object' ? JSON.stringify(v) : v
      }));
      const summaryCSV = toCSV(summaryRows, ['metric', 'value']);
      const dataCSV = toCSV(rows);
      const combined = `SUMMARY\n${summaryCSV}\n\nDATA\n${dataCSV}`;
      // BOM for Excel to recognize UTF-8
      const bom = '\uFEFF';
      fileBlob = new Blob([bom + combined], { type: 'application/vnd.ms-excel' });
      mimeType = 'application/vnd.ms-excel';
      fileName = `${baseName}.csv`; // Excel opens .csv with BOM correctly
    } else if (format === 'pdf') {
      // Text-based PDF report (plain text, no binary PDF library needed)
      const text = buildPDFText(result);
      fileBlob = new Blob([text], { type: 'text/plain' });
      mimeType = 'text/plain';
      fileName = `${baseName}_summary.txt`;
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
    const defs = await base44.asServiceRole.entities.ReportDefinition.filter({ id: reportDefinitionId });
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