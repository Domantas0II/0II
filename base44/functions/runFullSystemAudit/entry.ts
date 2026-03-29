import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'ADMINISTRATOR') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sections = [];

  // 1. ORPHAN RECORDS
  try {
    const findings = [];
    const [reservations, deals, commissions, payouts, payoutItems, agreements, payments] = await Promise.all([
      base44.asServiceRole.entities.Reservation.list('-created_date', 500),
      base44.asServiceRole.entities.Deal.list('-created_date', 500),
      base44.asServiceRole.entities.Commission.list('-created_date', 500),
      base44.asServiceRole.entities.Payout.list('-created_date', 200),
      base44.asServiceRole.entities.PayoutItem.list('-created_date', 500),
      base44.asServiceRole.entities.Agreement.list('-created_date', 500),
      base44.asServiceRole.entities.Payment.list('-created_date', 500),
    ]);

    const dealIds = new Set(deals.map(d => d.id));
    const commIds = new Set(commissions.map(c => c.id));
    const payoutIds = new Set(payouts.map(p => p.id));
    const resIds = new Set(reservations.map(r => r.id));

    // Commissions without valid deal
    commissions.forEach(c => {
      if (!dealIds.has(c.dealId)) findings.push({ type: 'COMMISSION_NO_DEAL', id: c.id, ref: c.dealId, severity: 'high' });
    });
    // PayoutItems without valid payout
    payoutItems.forEach(pi => {
      if (!payoutIds.has(pi.payoutId)) findings.push({ type: 'PAYOUT_ITEM_NO_PAYOUT', id: pi.id, ref: pi.payoutId, severity: 'high' });
    });
    // PayoutItems without valid commission
    payoutItems.forEach(pi => {
      if (!commIds.has(pi.commissionId)) findings.push({ type: 'PAYOUT_ITEM_NO_COMMISSION', id: pi.id, ref: pi.commissionId, severity: 'medium' });
    });
    // Agreements without reservation
    agreements.forEach(a => {
      if (a.reservationId && !resIds.has(a.reservationId)) findings.push({ type: 'AGREEMENT_NO_RESERVATION', id: a.id, ref: a.reservationId, severity: 'medium' });
    });
    // Payments without agreement
    const agreementIds = new Set(agreements.map(a => a.id));
    payments.forEach(p => {
      if (p.agreementId && !agreementIds.has(p.agreementId)) findings.push({ type: 'PAYMENT_NO_AGREEMENT', id: p.id, ref: p.agreementId, severity: 'medium' });
    });

    sections.push({
      name: 'orphan_records',
      status: findings.filter(f => f.severity === 'high').length > 0 ? 'critical' : findings.length > 0 ? 'warning' : 'ok',
      message: findings.length === 0 ? 'No orphan records found' : `${findings.length} orphan record(s) detected`,
      findings,
    });
  } catch (e) {
    sections.push({ name: 'orphan_records', status: 'warning', message: `Check failed: ${e.message}`, findings: [] });
  }

  // 2. CRITICAL FLOW CHAIN (Reservation → Deal → Commission → Payout)
  try {
    const findings = [];
    const deals = await base44.asServiceRole.entities.Deal.filter({ status: 'won' }, '-created_date', 100);
    const commissions = await base44.asServiceRole.entities.Commission.list('-created_date', 500);
    const commByDeal = {};
    commissions.forEach(c => { commByDeal[c.dealId] = c; });

    deals.forEach(d => {
      if (!commByDeal[d.id]) findings.push({ type: 'WON_DEAL_NO_COMMISSION', id: d.id, severity: 'critical' });
    });

    const approvedComms = commissions.filter(c => c.status === 'approved' && c.managerPayoutStatus === 'payable');
    const payoutItems = await base44.asServiceRole.entities.PayoutItem.list('-created_date', 500);
    const payoutItemCommIds = new Set(payoutItems.map(pi => pi.commissionId));
    approvedComms.forEach(c => {
      if (!payoutItemCommIds.has(c.id)) findings.push({ type: 'APPROVED_COMM_NOT_IN_PAYOUT', id: c.id, severity: 'medium' });
    });

    sections.push({
      name: 'critical_flow_chain',
      status: findings.filter(f => f.severity === 'critical').length > 0 ? 'critical' : findings.length > 0 ? 'warning' : 'ok',
      message: findings.length === 0 ? 'Deal→Commission→Payout chain intact' : `${findings.length} chain issue(s)`,
      findings,
    });
  } catch (e) {
    sections.push({ name: 'critical_flow_chain', status: 'warning', message: `Check failed: ${e.message}`, findings: [] });
  }

  // 3. CONFLICTING STATUSES
  try {
    const findings = [];
    const [reservations, commissions] = await Promise.all([
      base44.asServiceRole.entities.Reservation.list('-created_date', 500),
      base44.asServiceRole.entities.Commission.list('-created_date', 500),
    ]);

    // Commission paid but company not received
    commissions.forEach(c => {
      if (c.status === 'paid' && c.companyCommissionReceiptStatus === 'not_received') {
        findings.push({ type: 'COMM_PAID_COMPANY_NOT_RECEIVED', id: c.id, severity: 'high' });
      }
      if (c.managerPayoutStatus === 'paid' && c.status !== 'paid') {
        findings.push({ type: 'MANAGER_PAID_COMM_NOT_PAID', id: c.id, severity: 'medium' });
      }
    });

    // Released reservations still active
    reservations.forEach(r => {
      if (r.status === 'active' && r.releasedAt) {
        findings.push({ type: 'RESERVATION_ACTIVE_BUT_RELEASED', id: r.id, severity: 'high' });
      }
    });

    sections.push({
      name: 'conflicting_statuses',
      status: findings.filter(f => f.severity === 'high').length > 0 ? 'critical' : findings.length > 0 ? 'warning' : 'ok',
      message: findings.length === 0 ? 'No conflicting statuses' : `${findings.length} status conflict(s)`,
      findings,
    });
  } catch (e) {
    sections.push({ name: 'conflicting_statuses', status: 'warning', message: `Check failed: ${e.message}`, findings: [] });
  }

  // 4. REQUIRED CONFIGURATION
  try {
    const findings = [];
    const [settings, commRules, projectFinancials, projects] = await Promise.all([
      base44.asServiceRole.entities.SystemSetting.list('-updated_date', 200),
      base44.asServiceRole.entities.CommissionRule.filter({ isActive: true }),
      base44.asServiceRole.entities.ProjectFinancialSettings.list('-updated_date', 200),
      base44.asServiceRole.entities.Project.filter({ status: 'active' }),
    ]);

    const requiredSettings = ['crm.defaultReservationDuration', 'sla.responseTimeHours'];
    const settingKeys = new Set(settings.map(s => s.key));
    requiredSettings.forEach(k => {
      if (!settingKeys.has(k)) findings.push({ type: 'MISSING_REQUIRED_SETTING', id: k, severity: 'high' });
    });

    if (commRules.length === 0) findings.push({ type: 'NO_ACTIVE_COMMISSION_RULES', id: 'commission_rules', severity: 'critical' });

    projects.forEach(p => {
      const hasFinancials = projectFinancials.some(pf => pf.projectId === p.id);
      if (!hasFinancials) findings.push({ type: 'PROJECT_NO_FINANCIAL_SETTINGS', id: p.id, severity: 'high' });
    });

    sections.push({
      name: 'required_configuration',
      status: findings.filter(f => f.severity === 'critical').length > 0 ? 'critical' : findings.length > 0 ? 'warning' : 'ok',
      message: findings.length === 0 ? 'All required configuration present' : `${findings.length} config issue(s)`,
      findings,
    });
  } catch (e) {
    sections.push({ name: 'required_configuration', status: 'warning', message: `Check failed: ${e.message}`, findings: [] });
  }

  // 5. DUPLICATE DETECTION
  try {
    const findings = [];
    const clients = await base44.asServiceRole.entities.Client.list('-created_date', 1000);
    const emailMap = {};
    clients.forEach(c => {
      if (c.email) {
        const key = c.email.toLowerCase().trim();
        if (emailMap[key]) findings.push({ type: 'DUPLICATE_CLIENT_EMAIL', id: c.id, ref: emailMap[key], severity: 'medium' });
        else emailMap[key] = c.id;
      }
    });

    sections.push({
      name: 'duplicate_detection',
      status: findings.length > 5 ? 'critical' : findings.length > 0 ? 'warning' : 'ok',
      message: findings.length === 0 ? 'No duplicates found' : `${findings.length} duplicate(s) found`,
      findings,
    });
  } catch (e) {
    sections.push({ name: 'duplicate_detection', status: 'warning', message: `Check failed: ${e.message}`, findings: [] });
  }

  const criticalCount = sections.filter(s => s.status === 'critical').length;
  const warningCount = sections.filter(s => s.status === 'warning').length;

  return Response.json({
    success: true,
    auditedAt: new Date().toISOString(),
    overallStatus: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
    summary: { critical: criticalCount, warning: warningCount, ok: sections.filter(s => s.status === 'ok').length },
    sections,
  });
});