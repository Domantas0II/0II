import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { scheduledReportId } = await req.json();
    if (!scheduledReportId) return Response.json({ error: 'scheduledReportId required' }, { status: 400 });

    const schedules = await base44.asServiceRole.entities.ScheduledReport.filter({ id: scheduledReportId });
    if (!schedules?.length) return Response.json({ error: 'ScheduledReport not found' }, { status: 404 });
    const schedule = schedules[0];

    if (!schedule.isActive) return Response.json({ skipped: true, reason: 'Schedule is inactive' });

    const defs = await base44.asServiceRole.entities.ReportDefinition.filter({ id: schedule.reportDefinitionId });
    if (!defs?.length) return Response.json({ error: 'ReportDefinition not found' }, { status: 404 });
    const def = defs[0];

    const now = new Date().toISOString();
    const ts = now.slice(0, 10);

    // Create pending execution
    const execution = await base44.asServiceRole.entities.ReportExecution.create({
      reportDefinitionId: schedule.reportDefinitionId,
      executedByUserId: 'system',
      executedAt: now,
      status: 'pending',
      reportType: def.type,
      format: 'csv'
    });

    // Generate report data
    let result;
    try {
      const config = def.configJson ? JSON.parse(def.configJson) : {};
      const genRes = await base44.asServiceRole.functions.invoke('generateReport', {
        reportDefinitionId: schedule.reportDefinitionId,
        filters: config,
        _systemMode: true
      });
      result = genRes?.data?.result;
      if (!result) throw new Error(genRes?.data?.error || 'generateReport returned no result');
    } catch (genError) {
      await base44.asServiceRole.entities.ReportExecution.update(execution.id, {
        status: 'failed',
        errorMessage: genError.message
      });
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'REPORT_FAILED',
        performedByUserId: 'system',
        performedByName: 'System (scheduled)',
        details: JSON.stringify({ scheduledReportId, reportDefinitionId: schedule.reportDefinitionId, error: genError.message })
      });
      return Response.json({ success: false, error: genError.message });
    }

    // Export to CSV and create FileAsset
    let resultFileAssetId = null;
    try {
      const rows = result.rows || [];
      const csv = toCSV(rows);
      const csvBlob = new Blob([csv], { type: 'text/csv' });
      const fileName = `scheduled_report_${def.type}_${ts}.csv`;

      const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: csvBlob });
      if (uploadResult?.file_url) {
        const fileAsset = await base44.asServiceRole.entities.FileAsset.create({
          fileName,
          originalFileName: fileName,
          mimeType: 'text/csv',
          fileUrl: uploadResult.file_url,
          assetType: 'document',
          visibility: 'internal',
          status: 'active',
          category: 'other',
          title: `${schedule.name} — ${ts}`,
          description: `Auto-scheduled ${def.type} report`,
          uploadedByUserId: 'system',
          uploadedByName: 'System (scheduled)'
        });
        resultFileAssetId = fileAsset.id;
      }
    } catch (_uploadError) {
      // Non-fatal: execution still completes, just without file artifact
    }

    // Send email notifications to recipients
    const recipients = schedule.recipientsJson ? JSON.parse(schedule.recipientsJson) : [];
    const emailsSent = [];

    for (const recipient of recipients) {
      if (recipient.type === 'email' && recipient.value) {
        const summaryLines = Object.entries(result.summary || {})
          .map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join('\n');
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipient.value,
          subject: `[Scheduled Report] ${def.name} — ${new Date().toLocaleDateString('lt-LT')}`,
          body: `Sveiki,\n\nAutomatiškai sugeneruota ataskaita: ${def.name}.\n\nSUMARY:\n${summaryLines}\n\nEilučių skaičius: ${result.rows?.length || 0}\n\nAtaskaita: ${result.type?.toUpperCase()}\n\n---\nCRM Sistema`
        }).catch(() => {});
        emailsSent.push(recipient.value);
      }
    }

    // Update execution: completed with file artifact
    const executionUpdate = {
      status: 'completed',
      rowCount: result.rows?.length || 0
    };
    if (resultFileAssetId) executionUpdate.resultFileAssetId = resultFileAssetId;

    await base44.asServiceRole.entities.ReportExecution.update(execution.id, executionUpdate);

    // Update schedule timestamps
    const nowDate = new Date();
    let nextRunAt = null;
    if (schedule.scheduleType === 'daily') {
      nextRunAt = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } else if (schedule.scheduleType === 'weekly') {
      nextRunAt = new Date(nowDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (schedule.scheduleType === 'monthly') {
      const next = new Date(nowDate);
      next.setMonth(next.getMonth() + 1);
      nextRunAt = next.toISOString();
    }

    await base44.asServiceRole.entities.ScheduledReport.update(scheduledReportId, {
      lastRunAt: now,
      nextRunAt
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'REPORT_RUN',
      performedByUserId: 'system',
      performedByName: 'System (scheduled)',
      details: JSON.stringify({
        scheduledReportId,
        reportDefinitionId: schedule.reportDefinitionId,
        rowCount: result.rows?.length || 0,
        resultFileAssetId,
        emailsSent
      })
    });

    return Response.json({
      success: true,
      executionId: execution.id,
      rowCount: result.rows?.length || 0,
      resultFileAssetId,
      emailsSent
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});