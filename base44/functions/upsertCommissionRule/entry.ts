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

    const { id, projectId, appliesTo, calculationType, value, vatMode, isActive } = await req.json();

    // Validation
    if (!appliesTo || !calculationType || value === undefined || !vatMode) {
      return Response.json({ error: 'appliesTo, calculationType, value, vatMode required' }, { status: 400 });
    }
    if (!['agent', 'partner', 'agency'].includes(appliesTo)) {
      return Response.json({ error: 'Invalid appliesTo' }, { status: 400 });
    }
    if (!['percentage', 'fixed'].includes(calculationType)) {
      return Response.json({ error: 'Invalid calculationType' }, { status: 400 });
    }
    if (!['with_vat', 'without_vat'].includes(vatMode)) {
      return Response.json({ error: 'Invalid vatMode' }, { status: 400 });
    }
    if (value <= 0) {
      return Response.json({ error: 'value must be > 0' }, { status: 400 });
    }
    if (calculationType === 'percentage' && value > 100) {
      return Response.json({ error: 'Percentage value cannot exceed 100' }, { status: 400 });
    }

    // Validate projectId if provided
    if (projectId) {
      const projects = await base44.asServiceRole.entities.Project.filter({ id: projectId });
      if (!projects || projects.length === 0) {
        return Response.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    let rule;
    let action;

    if (id) {
      // Update existing
      const existing = await base44.asServiceRole.entities.CommissionRule.filter({ id });
      if (!existing || existing.length === 0) {
        return Response.json({ error: 'CommissionRule not found' }, { status: 404 });
      }

      rule = await base44.asServiceRole.entities.CommissionRule.update(id, {
        projectId: projectId || null,
        appliesTo,
        calculationType,
        value,
        vatMode,
        isActive: isActive !== undefined ? isActive : existing[0].isActive
      });
      action = 'COMMISSION_RULE_UPDATED';
    } else {
      // Create new
      rule = await base44.asServiceRole.entities.CommissionRule.create({
        projectId: projectId || null,
        appliesTo,
        calculationType,
        value,
        vatMode,
        isActive: isActive !== undefined ? isActive : true,
        createdByUserId: user.id
      });
      action = 'COMMISSION_RULE_CREATED';
    }

    await base44.asServiceRole.entities.AuditLog.create({
      action,
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        ruleId: rule.id,
        projectId: projectId || 'global',
        appliesTo,
        calculationType,
        value,
        vatMode,
        isActive: rule.isActive
      })
    });

    return Response.json({ success: true, rule });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});