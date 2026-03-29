import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'ADMINISTRATOR') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const checks = [];

  // 1. SystemSettings required keys
  try {
    const settings = await base44.asServiceRole.entities.SystemSetting.list('-updated_date', 200);
    const keys = new Set(settings.map(s => s.key));
    const required = [
      'crm.defaultReservationDuration',
      'sla.responseTimeHours',
      'sla.dealCloseTimedays',
      'scoring.minScoreThreshold',
    ];
    const missing = required.filter(k => !keys.has(k));
    checks.push({
      name: 'system_settings',
      status: missing.length > 0 ? 'warning' : 'ok',
      message: missing.length === 0 ? `${settings.length} settings present` : `Missing: ${missing.join(', ')}`,
      items: missing.map(k => ({ key: k, issue: 'Required setting missing' })),
    });
  } catch (e) {
    checks.push({ name: 'system_settings', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 2. FeatureFlags validity
  try {
    const flags = await base44.asServiceRole.entities.FeatureFlag.list('-updated_date', 100);
    const issues = [];
    flags.forEach(f => {
      if (f.rolloutType === 'percentage' && (f.percentage == null || f.percentage < 0 || f.percentage > 100)) {
        issues.push({ key: f.key, issue: 'Invalid percentage value' });
      }
      if (f.rolloutType === 'role_based' && (!f.allowedRoles || f.allowedRoles.length === 0)) {
        issues.push({ key: f.key, issue: 'role_based flag has no allowedRoles' });
      }
    });
    checks.push({
      name: 'feature_flags',
      status: issues.length > 0 ? 'warning' : 'ok',
      message: issues.length === 0 ? `${flags.length} flags valid` : `${issues.length} flag configuration issue(s)`,
      items: issues,
    });
  } catch (e) {
    checks.push({ name: 'feature_flags', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 3. SystemLimits
  try {
    const limits = await base44.asServiceRole.entities.SystemLimit.list('-updated_date', 100);
    const issues = limits.filter(l => l.value == null || l.value < 0).map(l => ({ key: l.key, issue: 'Invalid limit value' }));
    checks.push({
      name: 'system_limits',
      status: issues.length > 0 ? 'warning' : 'ok',
      message: issues.length === 0 ? `${limits.length} limits valid` : `${issues.length} limit issue(s)`,
      items: issues,
    });
  } catch (e) {
    checks.push({ name: 'system_limits', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 4. CommissionRules coverage
  try {
    const rules = await base44.asServiceRole.entities.CommissionRule.filter({ isActive: true });
    const hasAgent = rules.some(r => r.appliesTo === 'agent');
    const hasPartner = rules.some(r => r.appliesTo === 'partner');
    const issues = [];
    if (rules.length === 0) issues.push({ key: 'commission_rules', issue: 'No active commission rules defined' });
    if (!hasAgent) issues.push({ key: 'agent_rule', issue: 'No active agent commission rule' });
    if (!hasPartner) issues.push({ key: 'partner_rule', issue: 'No active partner commission rule' });
    checks.push({
      name: 'commission_rules',
      status: rules.length === 0 ? 'critical' : issues.length > 0 ? 'warning' : 'ok',
      message: rules.length === 0 ? 'CRITICAL: No active commission rules!' : issues.length === 0 ? `${rules.length} active rules OK` : `${issues.length} coverage gap(s)`,
      items: issues,
    });
  } catch (e) {
    checks.push({ name: 'commission_rules', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 5. ProjectFinancialSettings for active projects
  try {
    const [projects, financials] = await Promise.all([
      base44.asServiceRole.entities.Project.filter({ status: 'active' }),
      base44.asServiceRole.entities.ProjectFinancialSettings.list('-updated_date', 200),
    ]);
    const finProjectIds = new Set(financials.map(f => f.projectId));
    const missing = projects.filter(p => !finProjectIds.has(p.id));
    checks.push({
      name: 'project_financial_settings',
      status: missing.length > 0 ? 'warning' : 'ok',
      message: missing.length === 0 ? `All ${projects.length} active project(s) have financial settings` : `${missing.length} project(s) missing financial settings`,
      items: missing.map(p => ({ key: p.id, issue: `Project "${p.projectName}" has no financial settings` })),
    });
  } catch (e) {
    checks.push({ name: 'project_financial_settings', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 6. SLAConfig
  try {
    const slaConfigs = await base44.asServiceRole.entities.SLAConfig.list('-updated_date', 100);
    checks.push({
      name: 'sla_config',
      status: slaConfigs.length === 0 ? 'warning' : 'ok',
      message: slaConfigs.length === 0 ? 'No SLA configs defined' : `${slaConfigs.length} SLA config(s) defined`,
      items: [],
    });
  } catch (e) {
    checks.push({ name: 'sla_config', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  const criticalCount = checks.filter(c => c.status === 'critical').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return Response.json({
    success: true,
    validatedAt: new Date().toISOString(),
    overallStatus: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
    summary: { critical: criticalCount, warning: warningCount, ok: checks.filter(c => c.status === 'ok').length },
    checks,
  });
});