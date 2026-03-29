import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);
const DEFAULT_VAT_RATE = 21;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { dealId } = await req.json();
    if (!dealId) return Response.json({ error: 'dealId required' }, { status: 400 });

    // Fetch deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    if (!deals || deals.length === 0) return Response.json({ error: 'Deal not found' }, { status: 404 });
    const deal = deals[0];

    // Validate: deal must have signed agreement
    if (deal.agreementId) {
      const agreements = await base44.asServiceRole.entities.Agreement.filter({ id: deal.agreementId });
      if (!agreements || agreements.length === 0 || agreements[0].status !== 'signed') {
        return Response.json({ error: 'Deal must have a signed agreement' }, { status: 400 });
      }
    }

    // IDEMPOTENCY: Check if commission already exists for this deal + soldBy user
    const existing = await base44.asServiceRole.entities.Commission.filter({
      dealId,
      userId: deal.soldByUserId
    });
    if (existing && existing.length > 0) {
      return Response.json({ error: 'Commission already exists for this deal and agent', commissionId: existing[0].id }, { status: 409 });
    }

    // Find applicable CommissionRule: project-specific first, then global
    let rule = null;
    const projectRules = await base44.asServiceRole.entities.CommissionRule.filter({
      projectId: deal.projectId,
      appliesTo: 'agent',
      isActive: true
    });
    if (projectRules && projectRules.length > 0) {
      rule = projectRules[0];
    } else {
      // Fall back to global rule (no projectId)
      const allRules = await base44.asServiceRole.entities.CommissionRule.filter({
        appliesTo: 'agent',
        isActive: true
      });
      const globalRules = (allRules || []).filter(r => !r.projectId);
      if (globalRules.length > 0) rule = globalRules[0];
    }

    // If no rule, use deal's own commissionPercent if available
    let grossAmount = 0;
    let vatRate = DEFAULT_VAT_RATE;

    if (rule) {
      if (rule.calculationType === 'percentage') {
        grossAmount = (deal.totalAmount * rule.value) / 100;
      } else {
        grossAmount = rule.value;
      }
      // VAT calculation based on rule's vatMode
      if (rule.vatMode === 'with_vat') {
        const amountWithoutVat = grossAmount / (1 + vatRate / 100);
        const vatAmount = grossAmount - amountWithoutVat;
        const commission = await base44.asServiceRole.entities.Commission.create({
          dealId,
          userId: deal.soldByUserId,
          role: 'agent',
          amount: Math.round(grossAmount * 100) / 100,
          amountWithoutVat: Math.round(amountWithoutVat * 100) / 100,
          vatAmount: Math.round(vatAmount * 100) / 100,
          vatRate,
          status: 'pending',
          commissionRuleId: rule.id,
          projectId: deal.projectId,
          calculatedAt: new Date().toISOString()
        });
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'COMMISSION_CREATED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          details: JSON.stringify({ commissionId: commission.id, dealId, amount: commission.amount, ruleId: rule.id })
        });
        return Response.json({ success: true, commission });
      } else {
        // without_vat: grossAmount is net, add VAT on top
        const vatAmount = grossAmount * (vatRate / 100);
        const totalAmount = grossAmount + vatAmount;
        const commission = await base44.asServiceRole.entities.Commission.create({
          dealId,
          userId: deal.soldByUserId,
          role: 'agent',
          amount: Math.round(totalAmount * 100) / 100,
          amountWithoutVat: Math.round(grossAmount * 100) / 100,
          vatAmount: Math.round(vatAmount * 100) / 100,
          vatRate,
          status: 'pending',
          commissionRuleId: rule.id,
          projectId: deal.projectId,
          calculatedAt: new Date().toISOString()
        });
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'COMMISSION_CREATED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          details: JSON.stringify({ commissionId: commission.id, dealId, amount: commission.amount, ruleId: rule.id })
        });
        return Response.json({ success: true, commission });
      }
    } else if (deal.commissionPercent) {
      // Fallback: use deal's own commissionPercent
      const isWithVat = deal.commissionVatMode === 'with_vat';
      if (isWithVat) {
        grossAmount = (deal.totalAmount * deal.commissionPercent) / 100;
        const amountWithoutVat = grossAmount / (1 + vatRate / 100);
        const vatAmount = grossAmount - amountWithoutVat;
        const commission = await base44.asServiceRole.entities.Commission.create({
          dealId,
          userId: deal.soldByUserId,
          role: 'agent',
          amount: Math.round(grossAmount * 100) / 100,
          amountWithoutVat: Math.round(amountWithoutVat * 100) / 100,
          vatAmount: Math.round(vatAmount * 100) / 100,
          vatRate,
          status: 'pending',
          projectId: deal.projectId,
          calculatedAt: new Date().toISOString()
        });
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'COMMISSION_CREATED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          details: JSON.stringify({ commissionId: commission.id, dealId, amount: commission.amount, source: 'deal_percent' })
        });
        return Response.json({ success: true, commission });
      } else {
        grossAmount = (deal.totalAmount * deal.commissionPercent) / 100;
        const vatAmount = grossAmount * (vatRate / 100);
        const totalAmount = grossAmount + vatAmount;
        const commission = await base44.asServiceRole.entities.Commission.create({
          dealId,
          userId: deal.soldByUserId,
          role: 'agent',
          amount: Math.round(totalAmount * 100) / 100,
          amountWithoutVat: Math.round(grossAmount * 100) / 100,
          vatAmount: Math.round(vatAmount * 100) / 100,
          vatRate,
          status: 'pending',
          projectId: deal.projectId,
          calculatedAt: new Date().toISOString()
        });
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'COMMISSION_CREATED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          details: JSON.stringify({ commissionId: commission.id, dealId, amount: commission.amount, source: 'deal_percent' })
        });
        return Response.json({ success: true, commission });
      }
    } else {
      return Response.json({ error: 'No applicable commission rule found and deal has no commissionPercent' }, { status: 422 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});