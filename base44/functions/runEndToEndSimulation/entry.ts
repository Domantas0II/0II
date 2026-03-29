import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'ADMINISTRATOR') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const steps = [];
  let passed = 0;
  let failed = 0;

  const runStep = async (name, fn) => {
    const t0 = Date.now();
    try {
      const data = await fn();
      const durationMs = Date.now() - t0;
      steps.push({ step: name, status: 'passed', durationMs, data });
      passed++;
    } catch (e) {
      const durationMs = Date.now() - t0;
      steps.push({ step: name, status: 'failed', durationMs, error: e.message });
      failed++;
    }
  };

  // Step 1: DB connectivity
  await runStep('db_connectivity', async () => {
    const projects = await base44.asServiceRole.entities.Project.list('-created_date', 1);
    return { dryRun: true, wouldCreate: `DB reachable, ${projects.length} project(s) found` };
  });

  // Step 2: ProjectInquiry simulation
  await runStep('inquiry_intake', async () => {
    const projects = await base44.asServiceRole.entities.Project.filter({ status: 'active' }, '-created_date', 1);
    const project = projects[0];
    if (!project) return { dryRun: true, wouldCreate: 'SKIP: No active projects to simulate inquiry for' };
    return { dryRun: true, wouldCreate: `Would create ProjectInquiry for project "${project.projectName}"` };
  });

  // Step 3: Client creation simulation
  await runStep('client_creation', async () => {
    const clients = await base44.asServiceRole.entities.Client.list('-created_date', 1);
    return { dryRun: true, wouldCreate: `Would create Client record. System has ${clients.length} client(s).` };
  });

  // Step 4: Unit availability check
  await runStep('unit_availability_check', async () => {
    const units = await base44.asServiceRole.entities.SaleUnit.filter({ status: 'available' }, '-created_date', 5);
    if (units.length === 0) return { dryRun: true, wouldCreate: 'SKIP: No available units — reservation simulation skipped' };
    return { dryRun: true, wouldCreate: `${units.length} available unit(s) found — reservation possible` };
  });

  // Step 5: Reservation simulation
  await runStep('reservation_simulation', async () => {
    const [units, clients, users] = await Promise.all([
      base44.asServiceRole.entities.SaleUnit.filter({ status: 'available' }, '-created_date', 1),
      base44.asServiceRole.entities.Client.list('-created_date', 1),
      base44.asServiceRole.entities.User.list('-created_date', 1),
    ]);
    if (!units[0] || !clients[0]) return { dryRun: true, wouldCreate: 'SKIP: Need unit + client' };
    return {
      dryRun: true,
      wouldCreate: `Would create Reservation: unit="${units[0].unitNumber || units[0].id.slice(-6)}", client="${clients[0].fullName || clients[0].email}"`,
    };
  });

  // Step 6: Deal creation simulation
  await runStep('deal_creation_simulation', async () => {
    const commRules = await base44.asServiceRole.entities.CommissionRule.filter({ isActive: true });
    if (commRules.length === 0) throw new Error('No active commission rules — Deal.createDeal would fail');
    return { dryRun: true, wouldCreate: `Would create Deal. ${commRules.length} active commission rule(s) available.` };
  });

  // Step 7: Commission calculation simulation
  await runStep('commission_calculation_simulation', async () => {
    const rules = await base44.asServiceRole.entities.CommissionRule.filter({ isActive: true });
    if (rules.length === 0) throw new Error('No commission rules to apply');
    const rule = rules[0];
    const sampleBase = 100000;
    const totalCommission = rule.calculationType === 'percentage' ? (sampleBase * rule.value / 100) : rule.value;
    return {
      dryRun: true,
      wouldCreate: `Would calculate Commission: base=€${sampleBase}, rate=${rule.value}${rule.calculationType === 'percentage' ? '%' : '€'}, total=€${totalCommission.toFixed(2)}`,
    };
  });

  // Step 8: Payout grouping simulation
  await runStep('payout_grouping_simulation', async () => {
    const payableComms = await base44.asServiceRole.entities.Commission.filter({ managerPayoutStatus: 'payable' }, '-updated_date', 50);
    const userGroups = {};
    payableComms.forEach(c => { userGroups[c.userId] = (userGroups[c.userId] || 0) + 1; });
    const groupCount = Object.keys(userGroups).length;
    return {
      dryRun: true,
      wouldCreate: groupCount === 0
        ? 'No payable commissions — no payouts would be created'
        : `Would create ${groupCount} Payout(s) for ${payableComms.length} payable commission(s)`,
    };
  });

  // Step 9: Report generation simulation
  await runStep('report_generation_simulation', async () => {
    const reportDefs = await base44.asServiceRole.entities.ReportDefinition.filter({ isActive: true });
    return {
      dryRun: true,
      wouldCreate: reportDefs.length === 0
        ? 'No active report definitions — nothing to generate'
        : `Would execute ${reportDefs.length} report definition(s)`,
    };
  });

  return Response.json({
    success: true,
    simulatedAt: new Date().toISOString(),
    dryRun: true,
    status: failed === 0 ? 'passed' : 'failed',
    passed,
    failed,
    steps,
  });
});