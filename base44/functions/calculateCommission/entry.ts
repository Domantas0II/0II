import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const r2 = (n) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    if (user) {
      const role = ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[user.role] || user.role);
      if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { dealId } = await req.json();
    if (!dealId) return Response.json({ error: 'dealId required' }, { status: 400 });

    // 1. Fetch deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    if (!deals?.length) return Response.json({ error: 'Deal not found' }, { status: 404 });
    const deal = deals[0];
    if (!deal.soldByUserId) return Response.json({ error: 'Deal has no soldByUserId' }, { status: 422 });

    // 2. Idempotency
    const existing = await base44.asServiceRole.entities.Commission.filter({ dealId, userId: deal.soldByUserId });
    if (existing?.length > 0) {
      return Response.json({ error: 'Commission already exists', commissionId: existing[0].id }, { status: 409 });
    }

    // 3. Fetch ReservationBundle for saleBaseAmount
    const reservations = await base44.asServiceRole.entities.Reservation.filter({ id: deal.reservationId });
    const reservation = reservations?.[0];
    let saleBaseAmount = deal.totalAmount; // fallback
    if (reservation?.bundleId) {
      const bundles = await base44.asServiceRole.entities.ReservationBundle.filter({ id: reservation.bundleId });
      if (bundles?.[0]?.finalTotalPrice) saleBaseAmount = bundles[0].finalTotalPrice;
    }

    // 4. Fetch ProjectFinancialSettings
    const finSettings = await base44.asServiceRole.entities.ProjectFinancialSettings.filter({ projectId: deal.projectId });
    const fin = finSettings?.[0];

    // 5. Resolve commission config: ProjectFinancialSettings > CommissionRule > deal fallback
    let commissionCalculationPercent = fin?.commissionCalculationPercent || null;
    let companyShare = fin?.companyCommissionSharePercent ?? 70;
    let managerShare = fin?.managerCommissionSharePercent ?? 30;
    const splitBase = fin?.commissionSplitBase || 'without_vat';

    if (!commissionCalculationPercent) {
      // Try CommissionRule
      const allRules = await base44.asServiceRole.entities.CommissionRule.filter({ appliesTo: 'agent', isActive: true });
      const projectRules = (allRules || []).filter(r => r.projectId === deal.projectId);
      const globalRules = (allRules || []).filter(r => !r.projectId);
      let rule = null;
      if (projectRules.length >= 1) {
        projectRules.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        rule = projectRules[0];
      } else if (globalRules.length >= 1) {
        globalRules.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        rule = globalRules[0];
      }
      if (rule?.calculationType === 'percentage') commissionCalculationPercent = rule.value;
      else if (rule?.calculationType === 'fixed') {
        // Fixed rule: use directly as total commission, skip percent
        commissionCalculationPercent = null;
      }
    }

    // 6. Calculate totalCommissionBaseAmount
    // Split base determines what PVM to apply on saleBaseAmount before splitting
    // For MVP: splitBase just controls how we label/record it; actual bundle price is always the base
    const totalCommissionBaseAmount = commissionCalculationPercent
      ? r2(saleBaseAmount * commissionCalculationPercent / 100)
      : (deal.commissionPercent ? r2(saleBaseAmount * deal.commissionPercent / 100) : null);

    if (!totalCommissionBaseAmount) {
      return Response.json({ error: 'No commissionCalculationPercent found in ProjectFinancialSettings, CommissionRule, or Deal' }, { status: 422 });
    }

    const usedPercent = commissionCalculationPercent || deal.commissionPercent;

    // 7. Split
    const companyCommissionAmount = r2(totalCommissionBaseAmount * companyShare / 100);
    const managerCommissionAmount = r2(totalCommissionBaseAmount * managerShare / 100);

    // 8. Manager VAT
    const managers = await base44.asServiceRole.entities.User.filter({ id: deal.soldByUserId });
    const manager = managers?.[0];
    const isVatPayer = manager?.isVatPayer === true;
    const vatRate = (manager?.vatRate && manager.vatRate > 0) ? manager.vatRate : 21;

    let managerVatMode, managerVatRate, managerAmountWithoutVat, managerVatAmount, managerAmountWithVat;

    if (isVatPayer) {
      managerVatMode = 'with_vat';
      managerVatRate = vatRate;
      managerAmountWithoutVat = managerCommissionAmount;
      managerVatAmount = r2(managerCommissionAmount * vatRate / 100);
      managerAmountWithVat = r2(managerCommissionAmount + managerVatAmount);
    } else {
      managerVatMode = 'without_vat';
      managerVatRate = 0;
      managerAmountWithoutVat = managerCommissionAmount;
      managerVatAmount = 0;
      managerAmountWithVat = managerCommissionAmount;
    }

    // 9. Create Commission
    const commissionData = {
      dealId,
      userId: deal.soldByUserId,
      role: 'agent',
      projectId: deal.projectId,
      saleBaseAmount: r2(saleBaseAmount),
      commissionPercentApplied: usedPercent,
      totalCommissionBaseAmount,
      companyCommissionSharePercent: companyShare,
      managerCommissionSharePercent: managerShare,
      companyCommissionAmount,
      managerCommissionAmount,
      managerVatMode,
      managerVatRate,
      managerCommissionAmountWithoutVat: managerAmountWithoutVat,
      managerCommissionVatAmount: managerVatAmount,
      managerCommissionAmountWithVat: managerAmountWithVat,
      status: 'pending',
      companyCommissionReceiptStatus: 'not_received',
      managerPayoutStatus: 'not_payable_yet',
      calculatedAt: new Date().toISOString()
    };

    const commission = await base44.asServiceRole.entities.Commission.create(commissionData);

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'COMMISSION_CREATED',
      performedByUserId: user?.id || 'system',
      performedByName: user?.full_name || 'System (auto)',
      details: JSON.stringify({
        commissionId: commission.id,
        dealId,
        saleBaseAmount,
        totalCommissionBaseAmount,
        companyCommissionAmount,
        managerCommissionAmount,
        managerVatMode
      })
    });

    return Response.json({ success: true, commission });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});