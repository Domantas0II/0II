import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(role)) {
      return Response.json({ error: 'Forbidden: Manager or Admin required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id, name, projectId,
      commissionType, commissionValue, commissionBase,
      companyPercent, managerPercent,
      companyPercentWithPartner, managerPercentWithPartner, partnerPercent,
      vatMode, isActive
    } = body;

    // Validation
    if (!name) return Response.json({ error: 'name required' }, { status: 400 });
    if (!commissionType || !['percentage', 'fixed'].includes(commissionType)) {
      return Response.json({ error: 'Invalid commissionType' }, { status: 400 });
    }
    if (!commissionValue || commissionValue <= 0) {
      return Response.json({ error: 'commissionValue must be > 0' }, { status: 400 });
    }
    if (commissionType === 'percentage' && commissionValue > 100) {
      return Response.json({ error: 'Percentage cannot exceed 100' }, { status: 400 });
    }
    if (companyPercent === undefined || managerPercent === undefined) {
      return Response.json({ error: 'companyPercent and managerPercent required' }, { status: 400 });
    }

    // Validate no-partner split sums to 100
    const splitSum = (companyPercent || 0) + (managerPercent || 0);
    if (Math.abs(splitSum - 100) > 0.01) {
      return Response.json({ error: `No-partner split must sum to 100% (got ${splitSum}%)` }, { status: 400 });
    }

    // Validate partner split if provided
    if (partnerPercent !== undefined && partnerPercent > 0) {
      const partnerSum = (companyPercentWithPartner || 0) + (managerPercentWithPartner || 0) + (partnerPercent || 0);
      if (Math.abs(partnerSum - 100) > 0.01) {
        return Response.json({ error: `Partner split must sum to 100% (got ${partnerSum}%)` }, { status: 400 });
      }
    }

    if (projectId) {
      const projects = await base44.asServiceRole.entities.Project.filter({ id: projectId });
      if (!projects?.length) return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const ruleData = {
      name,
      projectId: projectId || null,
      commissionType,
      commissionValue,
      commissionBase: commissionBase || 'without_vat',
      companyPercent,
      managerPercent,
      companyPercentWithPartner: companyPercentWithPartner ?? null,
      managerPercentWithPartner: managerPercentWithPartner ?? null,
      partnerPercent: partnerPercent ?? null,
      vatMode: vatMode || 'without_vat',
      isActive: isActive !== undefined ? isActive : true
    };

    let rule;
    let action;

    if (id) {
      const existing = await base44.asServiceRole.entities.CommissionRule.filter({ id });
      if (!existing?.length) return Response.json({ error: 'CommissionRule not found' }, { status: 404 });
      rule = await base44.asServiceRole.entities.CommissionRule.update(id, ruleData);
      action = 'COMMISSION_RULE_UPDATED';
    } else {
      rule = await base44.asServiceRole.entities.CommissionRule.create({ ...ruleData, createdByUserId: user.id });
      action = 'COMMISSION_RULE_CREATED';
    }

    await base44.asServiceRole.entities.AuditLog.create({
      action,
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ ruleId: rule.id, name, projectId: projectId || 'global', commissionType, commissionValue })
    });

    return Response.json({ success: true, rule });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});