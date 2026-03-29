import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const now = () => new Date().toISOString();

// Safe check wrapper — never throws, always returns a result
async function safeCheck(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    return { checkName: name, ...result, durationMs: Date.now() - start };
  } catch (err) {
    return {
      checkName: name,
      status: 'critical',
      message: `Check threw exception: ${err.message}`,
      detailsJson: JSON.stringify({ error: err.message }),
      durationMs: Date.now() - start
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const checkedAt = now();
    const results = [];

    // 1. DB CONNECTIVITY — try listing a small entity
    results.push(await safeCheck('db_connectivity', async () => {
      await base44.asServiceRole.entities.SystemSetting.list('-created_date', 1);
      return { status: 'ok', message: 'Database reachable' };
    }));

    // 2. FAILED WEBHOOKS (last 1h)
    results.push(await safeCheck('webhook_failures_1h', async () => {
      const cutoff = new Date(Date.now() - 3600000).toISOString();
      const deliveries = await base44.asServiceRole.entities.WebhookDelivery.filter({ status: 'failed' });
      const recent = (deliveries || []).filter(d => (d.lastAttemptAt || d.createdAt) > cutoff);
      const count = recent.length;
      return {
        status: count >= 10 ? 'critical' : count >= 3 ? 'warning' : 'ok',
        message: `${count} failed webhook deliveries in last 1h`,
        detailsJson: JSON.stringify({ failedCount: count, threshold_warning: 3, threshold_critical: 10 })
      };
    }));

    // 3. UNPROCESSED INTEGRATION EVENTS (> 30 min old)
    results.push(await safeCheck('unprocessed_events', async () => {
      const cutoff = new Date(Date.now() - 1800000).toISOString();
      const events = await base44.asServiceRole.entities.IntegrationEvent.filter({ processed: false });
      const stale = (events || []).filter(e => (e.createdAt || e.created_date) < cutoff);
      return {
        status: stale.length >= 20 ? 'critical' : stale.length >= 5 ? 'warning' : 'ok',
        message: `${stale.length} unprocessed integration events older than 30min`,
        detailsJson: JSON.stringify({ staleCount: stale.length })
      };
    }));

    // 4. OVERDUE SLA TASKS
    results.push(await safeCheck('sla_overdue_tasks', async () => {
      const overdueTasks = await base44.asServiceRole.entities.Task.filter({ status: 'overdue' });
      const count = (overdueTasks || []).length;
      return {
        status: count >= 20 ? 'critical' : count >= 5 ? 'warning' : 'ok',
        message: `${count} overdue tasks`,
        detailsJson: JSON.stringify({ overdueCount: count })
      };
    }));

    // 5. STUCK RESERVATIONS (active > 72h)
    results.push(await safeCheck('stuck_reservations', async () => {
      const cutoff = new Date(Date.now() - 72 * 3600000).toISOString();
      const active = await base44.asServiceRole.entities.Reservation.filter({ status: 'active' });
      const stuck = (active || []).filter(r => (r.reservedAt || r.created_date) < cutoff);
      return {
        status: stuck.length >= 5 ? 'critical' : stuck.length >= 1 ? 'warning' : 'ok',
        message: `${stuck.length} reservations active > 72h`,
        detailsJson: JSON.stringify({ stuckCount: stuck.length, threshold: '72h' })
      };
    }));

    // 6. FAILED IMPORTS
    results.push(await safeCheck('failed_imports', async () => {
      const failed = await base44.asServiceRole.entities.ImportSession.filter({ status: 'failed' });
      const count = (failed || []).length;
      return {
        status: count >= 5 ? 'critical' : count >= 2 ? 'warning' : 'ok',
        message: `${count} failed import sessions`,
        detailsJson: JSON.stringify({ failedImports: count })
      };
    }));

    // 7. MISSING COMMISSIONS AFTER DEAL (deals without commission, > 1h old)
    results.push(await safeCheck('missing_commissions', async () => {
      const cutoff = new Date(Date.now() - 3600000).toISOString();
      const deals = await base44.asServiceRole.entities.Deal.list('-created_date', 200);
      const oldDeals = (deals || []).filter(d => (d.soldAt || d.created_date) < cutoff);
      let missing = 0;
      for (const deal of oldDeals.slice(0, 50)) {
        const comms = await base44.asServiceRole.entities.Commission.filter({ dealId: deal.id });
        if (!comms || comms.length === 0) missing++;
      }
      return {
        status: missing >= 3 ? 'critical' : missing >= 1 ? 'warning' : 'ok',
        message: `${missing} deals without commission (checked last 50)`,
        detailsJson: JSON.stringify({ missingCount: missing })
      };
    }));

    // 8. FAILED SCHEDULED REPORTS (last 24h)
    results.push(await safeCheck('failed_scheduled_reports', async () => {
      const cutoff = new Date(Date.now() - 86400000).toISOString();
      const executions = await base44.asServiceRole.entities.ReportExecution.filter({ status: 'failed' });
      const recent = (executions || []).filter(e => (e.executedAt || e.created_date) > cutoff);
      return {
        status: recent.length >= 3 ? 'critical' : recent.length >= 1 ? 'warning' : 'ok',
        message: `${recent.length} failed report executions in last 24h`,
        detailsJson: JSON.stringify({ failedReports: recent.length })
      };
    }));

    // 9. WEBHOOK ENDPOINTS REACHABILITY (check that at least one endpoint exists and is active)
    results.push(await safeCheck('webhook_endpoints', async () => {
      const eps = await base44.asServiceRole.entities.WebhookEndpoint.filter({ isActive: true });
      const count = (eps || []).length;
      // Not critical if none — just informational
      return {
        status: 'ok',
        message: `${count} active webhook endpoint(s) configured`,
        detailsJson: JSON.stringify({ activeEndpoints: count })
      };
    }));

    // Persist all results
    for (const r of results) {
      await base44.asServiceRole.entities.SystemHealthCheck.create({
        checkName: r.checkName,
        status: r.status,
        message: r.message,
        detailsJson: r.detailsJson || '{}',
        checkedAt
      });
    }

    const criticalCount = results.filter(r => r.status === 'critical').length;
    const warningCount = results.filter(r => r.status === 'warning').length;

    // Log to AuditLog if any critical
    if (criticalCount > 0) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'HEALTH_CHECK_CRITICAL',
        performedByUserId: 'system',
        performedByName: 'Health Monitor',
        details: JSON.stringify({ criticalCount, warningCount, checks: results.map(r => ({ name: r.checkName, status: r.status })) })
      });
    }

    return Response.json({
      success: true,
      checkedAt,
      total: results.length,
      ok: results.filter(r => r.status === 'ok').length,
      warning: warningCount,
      critical: criticalCount,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});