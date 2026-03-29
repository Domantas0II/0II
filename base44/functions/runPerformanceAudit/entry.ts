import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'ADMINISTRATOR') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const checks = [];

  // 1. Query latency benchmarks (real timing)
  try {
    const queryTests = [
      { label: 'Clients list (100)', fn: () => base44.asServiceRole.entities.Client.list('-created_date', 100) },
      { label: 'Commissions list (200)', fn: () => base44.asServiceRole.entities.Commission.list('-created_date', 200) },
      { label: 'AuditLog list (100)', fn: () => base44.asServiceRole.entities.AuditLog.list('-created_date', 100) },
      { label: 'FileAsset list (100)', fn: () => base44.asServiceRole.entities.FileAsset.list('-created_date', 100) },
      { label: 'Deal list (200)', fn: () => base44.asServiceRole.entities.Deal.list('-created_date', 200) },
    ];

    const results = [];
    for (const qt of queryTests) {
      const t0 = Date.now();
      const rows = await qt.fn();
      const durationMs = Date.now() - t0;
      results.push({
        label: qt.label,
        durationMs,
        count: rows.length,
        rating: durationMs > 4000 ? 'critical' : durationMs > 2000 ? 'warning' : 'ok',
      });
    }

    const slowQueries = results.filter(r => r.rating !== 'ok');
    checks.push({
      name: 'query_latency',
      status: results.some(r => r.rating === 'critical') ? 'critical' : slowQueries.length > 0 ? 'warning' : 'ok',
      message: slowQueries.length === 0 ? 'All queries within acceptable latency' : `${slowQueries.length} slow query(s) detected`,
      items: results,
    });
  } catch (e) {
    checks.push({ name: 'query_latency', status: 'warning', message: `Benchmark failed: ${e.message}`, items: [] });
  }

  // 2. Entity size check
  try {
    const [auditLogs, integrationEvents, webhookDeliveries, systemHealthChecks] = await Promise.all([
      base44.asServiceRole.entities.AuditLog.list('-created_date', 1),
      base44.asServiceRole.entities.IntegrationEvent.list('-created_date', 1),
      base44.asServiceRole.entities.WebhookDelivery.list('-created_date', 1),
      base44.asServiceRole.entities.SystemHealthCheck.list('-created_date', 1),
    ]);

    // We just do a count by listing more
    const [auditCount, eventCount, deliveryCount, healthCount] = await Promise.all([
      base44.asServiceRole.entities.AuditLog.list('-created_date', 10000),
      base44.asServiceRole.entities.IntegrationEvent.list('-created_date', 10000),
      base44.asServiceRole.entities.WebhookDelivery.list('-created_date', 10000),
      base44.asServiceRole.entities.SystemHealthCheck.list('-created_date', 10000),
    ]);

    const issues = [];
    if (auditCount.length > 5000) issues.push({ recommendation: `AuditLog has ${auditCount.length} records — consider archiving` });
    if (eventCount.length > 2000) issues.push({ recommendation: `IntegrationEvent has ${eventCount.length} records — consider cleanup` });
    if (deliveryCount.length > 2000) issues.push({ recommendation: `WebhookDelivery has ${deliveryCount.length} records — consider pruning` });
    if (healthCount.length > 1000) issues.push({ recommendation: `SystemHealthCheck has ${healthCount.length} records — consider retention policy` });

    checks.push({
      name: 'entity_size',
      status: issues.length > 2 ? 'warning' : 'ok',
      message: issues.length === 0 ? 'Entity sizes within acceptable range' : `${issues.length} entity collection(s) growing large`,
      items: issues,
    });
  } catch (e) {
    checks.push({ name: 'entity_size', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 3. Log accumulation
  try {
    const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const recentLogs = await base44.asServiceRole.entities.AuditLog.filter({ created_date: { $gte: cutoff24h } }, '-created_date', 500);
    checks.push({
      name: 'log_accumulation',
      status: recentLogs.length > 400 ? 'warning' : 'ok',
      message: recentLogs.length > 400 ? `High log volume in last 24h: ${recentLogs.length} entries` : `Normal log volume: ${recentLogs.length} entries in 24h`,
      items: recentLogs.length > 400 ? [{ recommendation: 'High audit log volume may indicate automated loops or excessive user activity' }] : [],
    });
  } catch (e) {
    checks.push({ name: 'log_accumulation', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 4. Stale unprocessed events
  try {
    const cutoff30m = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const stale = await base44.asServiceRole.entities.IntegrationEvent.filter({ processed: false, created_date: { $lte: cutoff30m } }, '-created_date', 100);
    checks.push({
      name: 'stale_events',
      status: stale.length > 50 ? 'critical' : stale.length > 10 ? 'warning' : 'ok',
      message: stale.length === 0 ? 'No stale unprocessed events' : `${stale.length} unprocessed event(s) older than 30min`,
      items: stale.length > 0 ? [{ issue: `${stale.length} events stuck — check event dispatcher`, recommendation: 'Run dispatchEvent or check for errors' }] : [],
    });
  } catch (e) {
    checks.push({ name: 'stale_events', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  const criticalCount = checks.filter(c => c.status === 'critical').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return Response.json({
    success: true,
    auditedAt: new Date().toISOString(),
    overallStatus: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
    checks,
  });
});