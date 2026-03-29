import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DEFAULT_VAT_RATE = 21;

// Pure calculation — no auth/role check, always uses asServiceRole
// Safe to call from createDeal (internal) or directly by admin/manager
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: allow internal service calls (no user) OR admin/manager
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_) {}

    if (user) {
      const role = ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[user.role] || user.role);
      if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // If no user (called internally from createDeal as fire-and-forget) — allow

    const { dealId } = await req.json();
    if (!dealId) return Response.json({ error: 'dealId required' }, { status: 400 });

    // Always use asServiceRole for stability — no user-scoped fetch here
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    if (!deals || deals.length === 0) return Response.json({ error: 'Deal not found' }, { status: 404 });
    const deal = deals[0];

    if (!deal.soldByUserId) {
      return Response.json({ error: 'Deal has no soldByUserId — cannot calculate commission' }, { status: 422 });
    }

    // IDEMPOTENCY: check existing commission for this deal+user
    const existing = await base44.asServiceRole.entities.Commission.filter({
      dealId,
      userId: deal.soldByUserId
    });
    if (existing && existing.length > 0) {
      return Response.json({
        error: 'Commission already exists for this deal and agent',
        commissionId: existing[0].id
      }, { status: 409 });
    }

    // === RULE RESOLUTION (deterministic, with conflict detection) ===
    const allActiveRules = await base44.asServiceRole.entities.CommissionRule.filter({
      appliesTo: 'agent',
      isActive: true
    });

    const projectRules = (allActiveRules || []).filter(r => r.projectId === deal.projectId);
    const globalRules = (allActiveRules || []).filter(r => !r.projectId);

    let rule = null;

    if (projectRules.length > 1) {
      // Multiple project-specific rules — conflict: log and use most recently created (deterministic)
      console.warn(`[calculateCommission] Multiple active project rules for projectId=${deal.projectId}. Using most recent. dealId=${dealId}`);
      projectRules.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      rule = projectRules[0];
    } else if (projectRules.length === 1) {
      rule = projectRules[0];
    } else if (globalRules.length > 0) {
      if (globalRules.length > 1) {
        console.warn(`[calculateCommission] Multiple active global rules. Using most recent. dealId=${dealId}`);
        globalRules.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      }
      rule = globalRules[0];
    }

    // === AMOUNT CALCULATION ===
    const vatRate = DEFAULT_VAT_RATE;
    let commissionData = null;

    if (rule) {
      let grossAmount = rule.calculationType === 'percentage'
        ? (deal.totalAmount * rule.value) / 100
        : rule.value;

      let amount, amountWithoutVat, vatAmount;

      if (rule.vatMode === 'with_vat') {
        // grossAmount already includes VAT
        amount = grossAmount;
        amountWithoutVat = grossAmount / (1 + vatRate / 100);
        vatAmount = amount - amountWithoutVat;
      } else {
        // grossAmount is net — add VAT
        amountWithoutVat = grossAmount;
        vatAmount = grossAmount * (vatRate / 100);
        amount = amountWithoutVat + vatAmount;
      }

      commissionData = {
        dealId,
        userId: deal.soldByUserId,
        role: 'agent',
        amount: Math.round(amount * 100) / 100,
        amountWithoutVat: Math.round(amountWithoutVat * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        vatRate,
        status: 'pending',
        commissionRuleId: rule.id,
        projectId: deal.projectId,
        calculatedAt: new Date().toISOString()
      };
    } else if (deal.commissionPercent) {
      // Fallback: deal's own commissionPercent
      const isWithVat = deal.commissionVatMode === 'with_vat';
      const gross = (deal.totalAmount * deal.commissionPercent) / 100;
      let amount, amountWithoutVat, vatAmount;

      if (isWithVat) {
        amount = gross;
        amountWithoutVat = gross / (1 + vatRate / 100);
        vatAmount = amount - amountWithoutVat;
      } else {
        amountWithoutVat = gross;
        vatAmount = gross * (vatRate / 100);
        amount = amountWithoutVat + vatAmount;
      }

      commissionData = {
        dealId,
        userId: deal.soldByUserId,
        role: 'agent',
        amount: Math.round(amount * 100) / 100,
        amountWithoutVat: Math.round(amountWithoutVat * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        vatRate,
        status: 'pending',
        projectId: deal.projectId,
        calculatedAt: new Date().toISOString()
      };
    } else {
      return Response.json({
        error: 'No applicable CommissionRule found and deal has no commissionPercent'
      }, { status: 422 });
    }

    const commission = await base44.asServiceRole.entities.Commission.create(commissionData);

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'COMMISSION_CREATED',
      performedByUserId: user?.id || 'system',
      performedByName: user?.full_name || 'System (auto)',
      details: JSON.stringify({
        commissionId: commission.id,
        dealId,
        amount: commission.amount,
        ruleId: rule?.id || null,
        source: rule ? 'rule' : 'deal_percent'
      })
    });

    return Response.json({ success: true, commission });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});