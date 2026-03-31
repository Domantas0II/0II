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

    // 2. Idempotency — check if already calculated
    const existing = await base44.asServiceRole.entities.Commission.filter({ dealId });
    if (existing?.length > 0) {
      return Response.json({ error: 'Commission already exists', commissions: existing }, { status: 409 });
    }

    // 3. Fetch sale base amount from ReservationBundle
    let saleBaseAmount = deal.totalAmount;
    if (deal.reservationId) {
      const reservations = await base44.asServiceRole.entities.Reservation.filter({ id: deal.reservationId });
      const reservation = reservations?.[0];
      if (reservation?.bundleId) {
        const bundles = await base44.asServiceRole.entities.ReservationBundle.filter({ id: reservation.bundleId });
        if (bundles?.[0]?.finalTotalPrice) saleBaseAmount = bundles[0].finalTotalPrice;
      }
    }

    // 4. Resolve CommissionRule
    // Priority: deal.commissionRuleId > ProjectFinancialSettings > active CommissionRule (project-specific, then global)
    let rule = null;

    if (deal.commissionRuleId) {
      const ruleRows = await base44.asServiceRole.entities.CommissionRule.filter({ id: deal.commissionRuleId });
      rule = ruleRows?.[0] || null;
    }

    if (!rule) {
      // Try ProjectFinancialSettings as a quick lookup
      const finRows = await base44.asServiceRole.entities.ProjectFinancialSettings.filter({ projectId: deal.projectId });
      const fin = finRows?.[0];

      if (fin?.commissionType && fin?.commissionValue) {
        // Use project-level settings as a synthetic rule-like object
        rule = {
          commissionType: fin.commissionType,
          commissionValue: fin.commissionValue,
          commissionBase: fin.commissionBase || 'without_vat',
          // No split info — will need CommissionRule for that
          _fromProjectSettings: true
        };
      }
    }

    if (!rule || rule._fromProjectSettings) {
      // Look for active CommissionRule
      const allRules = await base44.asServiceRole.entities.CommissionRule.filter({ isActive: true });
      const projectRules = (allRules || []).filter(r => r.projectId === deal.projectId);
      const globalRules = (allRules || []).filter(r => !r.projectId);
      const candidates = projectRules.length > 0 ? projectRules : globalRules;
      candidates.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      if (candidates.length > 0) {
        rule = rule?._fromProjectSettings
          ? { ...rule, ...candidates[0], _fromProjectSettings: false }
          : candidates[0];
      }
    }

    if (!rule) {
      return Response.json({ error: 'No CommissionRule found for this deal/project' }, { status: 422 });
    }

    // 5. Calculate total commission
    let totalCommission;
    if (rule.commissionType === 'percentage') {
      totalCommission = r2(saleBaseAmount * rule.commissionValue / 100);
    } else {
      totalCommission = r2(rule.commissionValue);
    }

    // 6. Determine split based on hasPartner flag
    const hasPartner = deal.hasPartner === true && !!deal.partnerId;

    let managerSharePercent, companySharePercent, partnerSharePercent;

    if (hasPartner) {
      managerSharePercent = rule.managerPercentWithPartner ?? rule.managerPercent;
      companySharePercent = rule.companyPercentWithPartner ?? rule.companyPercent;
      partnerSharePercent = rule.partnerPercent ?? 0;

      // Validate split sums to 100
      const total = (managerSharePercent || 0) + (companySharePercent || 0) + (partnerSharePercent || 0);
      if (Math.abs(total - 100) > 0.01) {
        return Response.json({ error: `Partner split does not sum to 100% (got ${total}%)` }, { status: 422 });
      }
    } else {
      managerSharePercent = rule.managerPercent;
      companySharePercent = rule.companyPercent;
      partnerSharePercent = 0;

      const total = (managerSharePercent || 0) + (companySharePercent || 0);
      if (Math.abs(total - 100) > 0.01) {
        return Response.json({ error: `Split does not sum to 100% (got ${total}%)` }, { status: 422 });
      }
    }

    const managerAmount = r2(totalCommission * managerSharePercent / 100);
    const companyAmount = r2(totalCommission * companySharePercent / 100);
    const partnerAmount = hasPartner ? r2(totalCommission * partnerSharePercent / 100) : 0;

    // 7. Manager VAT
    const managers = await base44.asServiceRole.entities.User.filter({ id: deal.soldByUserId });
    const manager = managers?.[0];
    const isVatPayer = manager?.isVatPayer === true;
    const vatRate = (manager?.vatRate && manager.vatRate > 0) ? manager.vatRate : 21;
    const vatMode = rule.vatMode || 'without_vat';

    const buildVatAmounts = (amount, isVat) => {
      if (isVat) {
        const vat = r2(amount * vatRate / 100);
        return { amountWithoutVat: amount, vatAmount: vat, amountWithVat: r2(amount + vat) };
      }
      return { amountWithoutVat: amount, vatAmount: 0, amountWithVat: amount };
    };

    const managerVat = buildVatAmounts(managerAmount, isVatPayer);

    const now = new Date().toISOString();
    const commissions = [];

    // 8. Create manager commission
    const managerCommission = await base44.asServiceRole.entities.Commission.create({
      dealId,
      role: 'manager',
      userId: deal.soldByUserId,
      projectId: deal.projectId,
      commissionRuleId: rule.id || null,
      saleBaseAmount: r2(saleBaseAmount),
      totalCommission,
      sharePercent: managerSharePercent,
      amount: managerAmount,
      companyAmount,
      // Company tracking fields (used for payout lock logic)
      companyCommissionReceiptStatus: 'not_received',
      managerPayoutStatus: 'not_payable_yet',
      vatMode,
      ...managerVat,
      status: 'pending',
      payoutStatus: 'not_payable_yet',
      calculatedAt: now
    });
    commissions.push(managerCommission);

    // 9. Create partner commission (if applicable)
    if (hasPartner) {
      const partnerCommission = await base44.asServiceRole.entities.Commission.create({
        dealId,
        role: 'partner',
        partnerId: deal.partnerId,
        projectId: deal.projectId,
        commissionRuleId: rule.id || null,
        saleBaseAmount: r2(saleBaseAmount),
        totalCommission,
        sharePercent: partnerSharePercent,
        amount: partnerAmount,
        companyAmount: null,
        vatMode,
        amountWithoutVat: partnerAmount,
        vatAmount: 0,
        amountWithVat: partnerAmount,
        status: 'pending',
        payoutStatus: 'not_payable_yet',
        calculatedAt: now
      });
      commissions.push(partnerCommission);
    }

    // 10. Audit
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'COMMISSION_CALCULATED',
      performedByUserId: user?.id || 'system',
      performedByName: user?.full_name || 'System',
      details: JSON.stringify({
        dealId,
        saleBaseAmount,
        totalCommission,
        hasPartner,
        managerAmount,
        companyAmount,
        partnerAmount: hasPartner ? partnerAmount : null,
        ruleId: rule.id || null
      })
    });

    return Response.json({ success: true, commissions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});