import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This function is called by automation (scheduled) — use service role
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

    // Create pending execution
    const execution = await base44.asServiceRole.entities.ReportExecution.create({
      reportDefinitionId: schedule.reportDefinitionId,
      executedByUserId: schedule.createdByUserId,
      executedAt: now,
      status: 'pending',
      reportType: def.type,
      format: 'csv'
    });

    // Generate report data
    let result;
    try {
      const config = def.configJson ? JSON.parse(def.configJson) : {};

      // Fetch all projects for this report definition
      const allProjects = await base44.asServiceRole.entities.Project.list('-created_date', 500);
      const projectIds = config.projectIds?.length
        ? config.projectIds
        : allProjects.map(p => p.id);

      // Invoke generateReport via the system user context
      const genRes = await base44.asServiceRole.functions.invoke('generateReport', {
        reportDefinitionId: schedule.reportDefinitionId,
        filters: config,
        _systemMode: true
      });

      result = genRes?.data?.result;
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

    // Send email notifications to recipients
    const recipients = schedule.recipientsJson ? JSON.parse(schedule.recipientsJson) : [];
    const emailsSent = [];

    for (const recipient of recipients) {
      if (recipient.type === 'email' && recipient.value) {
        const summaryLines = Object.entries(result?.summary || {})
          .map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join('\n');

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipient.value,
          subject: `[Scheduled Report] ${def.name} — ${new Date().toLocaleDateString('lt-LT')}`,
          body: `Sveiki,\n\nAutomatiškai sugeneruotas ${def.name} ataskaita.\n\nSUMARY:\n${summaryLines}\n\nEilučių skaičius: ${result?.rows?.length || 0}\n\nAtaskaita: ${result?.type?.toUpperCase()}\n\n---\nCRM Sistema`
        }).catch(() => {});
        emailsSent.push(recipient.value);
      }
    }

    // Update execution to completed
    await base44.asServiceRole.entities.ReportExecution.update(execution.id, {
      status: 'completed',
      resultJson: JSON.stringify(result),
      rowCount: result?.rows?.length || 0
    });

    // Update lastRunAt and compute nextRunAt
    const config = schedule.scheduleConfigJson ? JSON.parse(schedule.scheduleConfigJson) : {};
    let nextRunAt = null;
    const nowDate = new Date();
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
        rowCount: result?.rows?.length || 0,
        emailsSent
      })
    });

    return Response.json({ success: true, executionId: execution.id, rowCount: result?.rows?.length || 0, emailsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});