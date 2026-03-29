import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'ADMINISTRATOR') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const items = [];

  const addItem = (id, label, category, deployBlocker, statusFn) => {
    return statusFn().then(({ status, message }) => {
      items.push({ id, label, category, deployBlocker, status, message });
    }).catch(e => {
      items.push({ id, label, category, deployBlocker, status: 'warning', message: `Check error: ${e.message}` });
    });
  };

  await Promise.all([
    // Infrastructure
    addItem('db_connectivity', 'Database connectivity', 'infrastructure', true, async () => {
      await base44.asServiceRole.entities.Project.list('-created_date', 1);
      return { status: 'ok', message: 'Database reachable' };
    }),

    addItem('health_checks_ok', 'Recent health checks passing', 'infrastructure', true, async () => {
      const cutoff1h = new Date(Date.now() - 3600 * 1000).toISOString();
      const recentChecks = await base44.asServiceRole.entities.SystemHealthCheck.filter({ status: 'critical', checkedAt: { $gte: cutoff1h } }, '-checkedAt', 10);
      if (recentChecks.length > 0) return { status: 'critical', message: `${recentChecks.length} critical health check(s) in last hour` };
      return { status: 'ok', message: 'No critical health checks in last 1h' };
    }),

    addItem('no_open_critical_incidents', 'No open critical incidents', 'infrastructure', true, async () => {
      const criticalOpen = await base44.asServiceRole.entities.SystemIncident.filter({ status: 'open', severity: 'critical' });
      if (criticalOpen.length > 0) return { status: 'critical', message: `${criticalOpen.length} open critical incident(s)` };
      const highOpen = await base44.asServiceRole.entities.SystemIncident.filter({ status: 'open', severity: 'high' });
      if (highOpen.length > 0) return { status: 'warning', message: `${highOpen.length} open high-severity incident(s)` };
      return { status: 'ok', message: 'No open critical/high incidents' };
    }),

    // Data
    addItem('no_data_integrity_issues', 'No unresolved data integrity issues', 'data', true, async () => {
      const criticalIssues = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ resolved: false, severity: 'critical' });
      if (criticalIssues.length > 0) return { status: 'critical', message: `${criticalIssues.length} unresolved critical data integrity issue(s)` };
      const highIssues = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ resolved: false, severity: 'high' });
      if (highIssues.length > 0) return { status: 'warning', message: `${highIssues.length} unresolved high-severity issue(s)` };
      return { status: 'ok', message: 'No unresolved data integrity issues' };
    }),

    addItem('commission_chain_ok', 'Commission chain integrity (Won deals have commissions)', 'data', true, async () => {
      const wonDeals = await base44.asServiceRole.entities.Deal.filter({ status: 'won' }, '-created_date', 50);
      if (wonDeals.length === 0) return { status: 'ok', message: 'No won deals to check' };
      const commissions = await base44.asServiceRole.entities.Commission.list('-created_date', 500);
      const commDealIds = new Set(commissions.map(c => c.dealId));
      const missing = wonDeals.filter(d => !commDealIds.has(d.id));
      if (missing.length > 0) return { status: 'critical', message: `${missing.length}/${wonDeals.length} won deal(s) have no commission` };
      return { status: 'ok', message: `All ${wonDeals.length} won deal(s) have commissions` };
    }),

    // Configuration
    addItem('commission_rules_configured', 'Active commission rules exist', 'configuration', true, async () => {
      const rules = await base44.asServiceRole.entities.CommissionRule.filter({ isActive: true });
      if (rules.length === 0) return { status: 'critical', message: 'No active commission rules — calculateCommission will fail' };
      return { status: 'ok', message: `${rules.length} active commission rule(s) configured` };
    }),

    addItem('system_settings_populated', 'Critical system settings populated', 'configuration', false, async () => {
      const settings = await base44.asServiceRole.entities.SystemSetting.list('-updated_date', 200);
      const keys = new Set(settings.map(s => s.key));
      const required = ['crm.defaultReservationDuration', 'sla.responseTimeHours'];
      const missing = required.filter(k => !keys.has(k));
      if (missing.length > 0) return { status: 'warning', message: `Missing settings: ${missing.join(', ')}` };
      return { status: 'ok', message: `${settings.length} system settings defined` };
    }),

    addItem('feature_flags_valid', 'Feature flags properly configured', 'configuration', false, async () => {
      const flags = await base44.asServiceRole.entities.FeatureFlag.list('-updated_date', 100);
      const invalid = flags.filter(f => f.rolloutType === 'percentage' && (f.percentage == null || f.percentage < 0 || f.percentage > 100));
      if (invalid.length > 0) return { status: 'warning', message: `${invalid.length} flag(s) have invalid percentage` };
      return { status: 'ok', message: `${flags.length} feature flag(s) valid` };
    }),

    // Security
    addItem('no_expired_api_keys', 'No expired active API keys', 'security', true, async () => {
      const now = new Date();
      const apiKeys = await base44.asServiceRole.entities.ApiKey.filter({ isActive: true });
      const expired = apiKeys.filter(k => k.expiresAt && new Date(k.expiresAt) < now);
      if (expired.length > 0) return { status: 'critical', message: `${expired.length} active API key(s) are expired` };
      return { status: 'ok', message: `${apiKeys.length} API key(s) valid` };
    }),

    addItem('webhook_hmac_signing', 'Webhook endpoints have HMAC signing', 'security', false, async () => {
      const endpoints = await base44.asServiceRole.entities.WebhookEndpoint.filter({ isActive: true });
      const unsigned = endpoints.filter(e => !e.secret || e.secret.trim() === '');
      if (unsigned.length > 0) return { status: 'warning', message: `${unsigned.length} endpoint(s) missing HMAC secret` };
      if (endpoints.length === 0) return { status: 'ok', message: 'No active webhook endpoints' };
      return { status: 'ok', message: `All ${endpoints.length} endpoint(s) have HMAC signing` };
    }),
  ]);

  // Sort: critical first, then warning, then ok
  items.sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2 };
    return (order[a.status] || 2) - (order[b.status] || 2);
  });

  const summary = {
    ok: items.filter(i => i.status === 'ok').length,
    warning: items.filter(i => i.status === 'warning').length,
    critical: items.filter(i => i.status === 'critical').length,
    deployBlockers: items.filter(i => i.deployBlocker && i.status === 'critical').length,
  };

  const deployReady = summary.deployBlockers === 0;
  const blockers = items.filter(i => i.deployBlocker && i.status === 'critical').map(i => i.label);

  return Response.json({
    success: true,
    generatedAt: new Date().toISOString(),
    deployReady,
    blockers,
    summary,
    items,
  });
});