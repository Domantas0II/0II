import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);
const r2 = (n) => Math.round((n || 0) * 100) / 100;

// Returns projectIds the user is allowed to access
async function getAccessibleProjectIds(user, role, base44, requestedProjectIds) {
  if (role === 'ADMINISTRATOR') {
    if (requestedProjectIds?.length) return requestedProjectIds;
    const all = await base44.asServiceRole.entities.Project.list('-created_date', 500);
    return (all || []).map(p => p.id);
  }
  // SALES_MANAGER / SALES_AGENT / PROJECT_DEVELOPER — only assigned projects
  const assignments = await base44.asServiceRole.entities.UserProjectAssignment.filter({ userId: user.id });
  const assigned = (assignments || []).map(a => a.projectId);
  if (requestedProjectIds?.length) {
    return requestedProjectIds.filter(id => assigned.includes(id));
  }
  return assigned;
}

async function generateSalesReport(base44, projectIds, filters) {
  const { dateFrom, dateTo, agentIds } = filters;

  let deals = [];
  for (const pid of projectIds) {
    const d = await base44.asServiceRole.entities.Deal.filter({ projectId: pid });
    deals = deals.concat(d || []);
  }

  // Date filter
  if (dateFrom) deals = deals.filter(d => new Date(d.soldAt || d.created_date) >= new Date(dateFrom));
  if (dateTo)   deals = deals.filter(d => new Date(d.soldAt || d.created_date) <= new Date(dateTo));
  if (agentIds?.length) deals = deals.filter(d => agentIds.includes(d.soldByUserId));

  const totalValue = deals.reduce((s, d) => s + (d.totalAmount || 0), 0);
  const avgValue = deals.length ? totalValue / deals.length : 0;

  // Conversion: inquiries → deals ratio
  let totalInquiries = 0;
  for (const pid of projectIds) {
    const inq = await base44.asServiceRole.entities.ProjectInquiry.filter({ projectId: pid });
    totalInquiries += (inq || []).length;
  }
  const conversionRate = totalInquiries > 0 ? r2((deals.length / totalInquiries) * 100) : 0;

  return {
    type: 'sales',
    summary: {
      dealsCount: deals.length,
      totalSalesValue: r2(totalValue),
      avgDealValue: r2(avgValue),
      conversionRate,
      totalInquiries
    },
    rows: deals.slice(0, 2000).map(d => ({
      dealId: d.id,
      projectId: d.projectId,
      soldAt: d.soldAt,
      totalAmount: d.totalAmount,
      soldByUserId: d.soldByUserId,
      isDeveloperSale: d.isDeveloperSale
    }))
  };
}

async function generateFinanceReport(base44, projectIds, filters) {
  const { dateFrom, dateTo } = filters;

  let commissions = [];
  for (const pid of projectIds) {
    const c = await base44.asServiceRole.entities.Commission.filter({ projectId: pid });
    commissions = commissions.concat(c || []);
  }

  if (dateFrom) commissions = commissions.filter(c => new Date(c.calculatedAt) >= new Date(dateFrom));
  if (dateTo)   commissions = commissions.filter(c => new Date(c.calculatedAt) <= new Date(dateTo));

  const total = r2(commissions.reduce((s, c) => s + (c.totalCommissionBaseAmount || 0), 0));
  const companyTotal = r2(commissions.reduce((s, c) => s + (c.companyCommissionAmount || 0), 0));
  const managerTotal = r2(commissions.reduce((s, c) => s + (c.managerCommissionAmountWithVat || c.managerCommissionAmount || 0), 0));
  const paid = commissions.filter(c => c.managerPayoutStatus === 'paid');
  const payable = commissions.filter(c => c.managerPayoutStatus === 'payable');
  const pending = commissions.filter(c => c.status === 'pending');

  return {
    type: 'finance',
    summary: {
      totalCommissions: total,
      companyCommissionTotal: companyTotal,
      managerPayoutsTotal: managerTotal,
      paidCount: paid.length,
      paidTotal: r2(paid.reduce((s, c) => s + (c.managerCommissionAmountWithVat || c.managerCommissionAmount || 0), 0)),
      payableCount: payable.length,
      payableTotal: r2(payable.reduce((s, c) => s + (c.managerCommissionAmountWithVat || c.managerCommissionAmount || 0), 0)),
      pendingCount: pending.length
    },
    rows: commissions.slice(0, 2000).map(c => ({
      commissionId: c.id,
      dealId: c.dealId,
      projectId: c.projectId,
      userId: c.userId,
      status: c.status,
      saleBaseAmount: c.saleBaseAmount,
      totalCommissionBaseAmount: c.totalCommissionBaseAmount,
      companyCommissionAmount: c.companyCommissionAmount,
      managerCommissionAmount: c.managerCommissionAmount,
      managerCommissionAmountWithVat: c.managerCommissionAmountWithVat,
      managerPayoutStatus: c.managerPayoutStatus,
      companyCommissionReceiptStatus: c.companyCommissionReceiptStatus,
      calculatedAt: c.calculatedAt
    }))
  };
}

async function generatePipelineReport(base44, projectIds, filters, role) {
  const { dateFrom, dateTo } = filters;

  let inquiries = [], interests = [], reservations = [], deals = [];
  for (const pid of projectIds) {
    const [inq, int, res, dl] = await Promise.all([
      base44.asServiceRole.entities.ProjectInquiry.filter({ projectId: pid }),
      base44.asServiceRole.entities.ClientProjectInterest.filter({ projectId: pid }),
      base44.asServiceRole.entities.Reservation.filter({ projectId: pid }),
      base44.asServiceRole.entities.Deal.filter({ projectId: pid })
    ]);
    inquiries = inquiries.concat(inq || []);
    interests = interests.concat(int || []);
    reservations = reservations.concat(res || []);
    deals = deals.concat(dl || []);
  }

  const df = dateFrom ? new Date(dateFrom) : null;
  const dt = dateTo   ? new Date(dateTo)   : null;
  const inRange = (d, field) => {
    const t = new Date(d[field] || d.created_date);
    if (df && t < df) return false;
    if (dt && t > dt) return false;
    return true;
  };

  if (df || dt) {
    inquiries    = inquiries.filter(d => inRange(d, 'created_date'));
    interests    = interests.filter(d => inRange(d, 'created_date'));
    reservations = reservations.filter(d => inRange(d, 'created_date'));
    deals        = deals.filter(d => inRange(d, 'soldAt'));
  }

  // Stage distribution
  const stageCount = {};
  interests.forEach(i => { stageCount[i.pipelineStage] = (stageCount[i.pipelineStage] || 0) + 1; });

  return {
    type: 'pipeline',
    summary: {
      inquiriesCount: inquiries.length,
      interestsCount: interests.length,
      reservationsCount: reservations.length,
      dealsCount: deals.length,
      inquiriesToInterests: inquiries.length ? r2(interests.length / inquiries.length * 100) : 0,
      interestsToReservations: interests.length ? r2(reservations.length / interests.length * 100) : 0,
      reservationsToDeals: reservations.length ? r2(deals.length / reservations.length * 100) : 0,
      stageDistribution: stageCount
    },
    rows: interests.slice(0, 2000).map(i => ({
      interestId: i.id,
      ...(role !== 'PROJECT_DEVELOPER' ? { clientId: i.clientId } : {}),
      projectId: i.projectId,
      pipelineStage: i.pipelineStage,
      status: i.status,
      createdAt: i.created_date
    }))
  };
}

async function generateAgentPerformanceReport(base44, projectIds, filters, role, currentUser) {
  const { dateFrom, dateTo, agentIds: requestedAgentIds } = filters;

  // SALES_AGENT sees only self
  const agentFilter = role === 'SALES_AGENT'
    ? [currentUser.id]
    : (requestedAgentIds?.length ? requestedAgentIds : null);

  let deals = [];
  for (const pid of projectIds) {
    const d = await base44.asServiceRole.entities.Deal.filter({ projectId: pid });
    deals = deals.concat(d || []);
  }

  if (dateFrom) deals = deals.filter(d => new Date(d.soldAt || d.created_date) >= new Date(dateFrom));
  if (dateTo)   deals = deals.filter(d => new Date(d.soldAt || d.created_date) <= new Date(dateTo));
  if (agentFilter) deals = deals.filter(d => agentFilter.includes(d.soldByUserId));

  // Group by agent
  const byAgent = {};
  deals.forEach(d => {
    const uid = d.soldByUserId || 'unknown';
    if (!byAgent[uid]) byAgent[uid] = { userId: uid, dealsCount: 0, totalRevenue: 0 };
    byAgent[uid].dealsCount++;
    byAgent[uid].totalRevenue += (d.totalAmount || 0);
  });

  const rows = Object.values(byAgent).map(a => ({
    ...a,
    totalRevenue: r2(a.totalRevenue),
    avgDealValue: a.dealsCount ? r2(a.totalRevenue / a.dealsCount) : 0
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    type: 'agent_performance',
    summary: {
      agentsCount: rows.length,
      totalDeals: deals.length,
      totalRevenue: r2(deals.reduce((s, d) => s + (d.totalAmount || 0), 0))
    },
    rows
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    // PROJECT_DEVELOPER gets pipeline-only safe data
    const allowedRoles = ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT', 'PROJECT_DEVELOPER'];
    if (!allowedRoles.includes(role)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { reportDefinitionId, filters: overrideFilters, _systemMode } = await req.json();
    if (!reportDefinitionId) return Response.json({ error: 'reportDefinitionId required' }, { status: 400 });

    // _systemMode: called by runScheduledReport (no user session) — skip user auth checks
    const isSystemMode = _systemMode === true;

    const defs = await base44.asServiceRole.entities.ReportDefinition.filter({ id: reportDefinitionId });
    if (!defs?.length) return Response.json({ error: 'ReportDefinition not found' }, { status: 404 });
    const def = defs[0];

    const config = def.configJson ? JSON.parse(def.configJson) : {};
    const filters = { ...config, ...(overrideFilters || {}) };

    // Resolve accessible project IDs
    let projectIds;
    if (isSystemMode) {
      // System mode: use all projects from config, or all projects
      const allProjects = await base44.asServiceRole.entities.Project.list('-created_date', 500);
      projectIds = filters.projectIds?.length
        ? filters.projectIds
        : (allProjects || []).map(p => p.id);
    } else {
      projectIds = await getAccessibleProjectIds(user, role, base44, filters.projectIds);
      if (!projectIds.length) return Response.json({ error: 'No accessible projects' }, { status: 403 });
      // PROJECT_DEVELOPER: only pipeline report allowed (no client/financial data)
      if (role === 'PROJECT_DEVELOPER' && !['pipeline', 'sales'].includes(def.type)) {
        return Response.json({ error: 'PROJECT_DEVELOPER can only access pipeline and sales summary reports' }, { status: 403 });
      }
    }

    let result;
    if (def.type === 'sales')             result = await generateSalesReport(base44, projectIds, filters);
    else if (def.type === 'finance')      result = await generateFinanceReport(base44, projectIds, filters);
    else if (def.type === 'pipeline')     result = await generatePipelineReport(base44, projectIds, filters, isSystemMode ? 'SYSTEM' : role);
    else if (def.type === 'agent_performance') result = await generateAgentPerformanceReport(base44, projectIds, filters, role, user);
    else return Response.json({ error: `Unknown report type: ${def.type}` }, { status: 400 });

    // Save execution record
    const execution = await base44.asServiceRole.entities.ReportExecution.create({
      reportDefinitionId,
      executedByUserId: user.id,
      executedAt: new Date().toISOString(),
      status: 'completed',
      reportType: def.type,
      format: 'json',
      resultJson: JSON.stringify(result),
      filtersApplied: JSON.stringify({ projectIds, ...filters }),
      rowCount: result.rows?.length || 0
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'REPORT_GENERATED',
      performedByUserId: isSystemMode ? 'system' : user.id,
      performedByName: isSystemMode ? 'System (scheduled)' : user.full_name,
      details: JSON.stringify({ reportDefinitionId, type: def.type, rowCount: result.rows?.length || 0 })
    });

    return Response.json({ success: true, executionId: execution.id, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});