import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const now = () => new Date().toISOString();

async function safeCheck(name, fn) {
  try { return await fn(); } catch (e) { return []; }
}

async function createIssue(base44, issueType, entityType, entityId, description, severity) {
  return base44.asServiceRole.entities.DataIntegrityIssue.create({
    issueType,
    entityType,
    entityId,
    description,
    severity,
    detectedAt: now(),
    resolved: false
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const issues = [];
    const checkedAt = now();

    // 1. RESERVATION–UNIT MISMATCH: active reservation but unit not 'reserved'
    await safeCheck('reservation_unit_sync', async () => {
      const active = await base44.asServiceRole.entities.Reservation.filter({ status: 'active' });
      for (const res of (active || []).slice(0, 100)) {
        const bundles = await base44.asServiceRole.entities.ReservationBundle.filter({ id: res.bundleId });
        const bundle = bundles?.[0];
        if (!bundle?.unitId) continue;
        const units = await base44.asServiceRole.entities.SaleUnit.filter({ id: bundle.unitId });
        const unit = units?.[0];
        if (unit && unit.internalStatus !== 'reserved' && unit.internalStatus !== 'sold') {
          // Check not already reported
          const existing = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ entityId: res.id, issueType: 'RESERVATION_UNIT_MISMATCH', resolved: false });
          if (!existing?.length) {
            const issue = await createIssue(base44, 'RESERVATION_UNIT_MISMATCH', 'Reservation', res.id,
              `Active reservation ${res.id} but unit ${bundle.unitId} status is '${unit.internalStatus}'`, 'high');
            issues.push(issue);
          }
        }
      }
    });

    // 2. DEAL WITHOUT COMMISSION (> 2h old)
    await safeCheck('deal_no_commission', async () => {
      const cutoff = new Date(Date.now() - 7200000).toISOString();
      const deals = await base44.asServiceRole.entities.Deal.list('-created_date', 100);
      for (const deal of (deals || []).filter(d => (d.soldAt || d.created_date) < cutoff)) {
        const comms = await base44.asServiceRole.entities.Commission.filter({ dealId: deal.id });
        if (!comms?.length) {
          const existing = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ entityId: deal.id, issueType: 'DEAL_NO_COMMISSION', resolved: false });
          if (!existing?.length) {
            const issue = await createIssue(base44, 'DEAL_NO_COMMISSION', 'Deal', deal.id,
              `Deal ${deal.id} (${deal.soldAt?.slice(0,10)}) has no Commission record`, 'critical');
            issues.push(issue);
          }
        }
      }
    });

    // 3. COMMISSION WITHOUT DEAL
    await safeCheck('commission_no_deal', async () => {
      const comms = await base44.asServiceRole.entities.Commission.list('-created_date', 100);
      for (const c of (comms || [])) {
        if (!c.dealId) continue;
        const deals = await base44.asServiceRole.entities.Deal.filter({ id: c.dealId });
        if (!deals?.length) {
          const existing = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ entityId: c.id, issueType: 'COMMISSION_NO_DEAL', resolved: false });
          if (!existing?.length) {
            const issue = await createIssue(base44, 'COMMISSION_NO_DEAL', 'Commission', c.id,
              `Commission ${c.id} references non-existent deal ${c.dealId}`, 'high');
            issues.push(issue);
          }
        }
      }
    });

    // 4. PAYOUT WITHOUT ITEMS
    await safeCheck('payout_no_items', async () => {
      const payouts = await base44.asServiceRole.entities.Payout.list('-created_date', 50);
      for (const p of (payouts || [])) {
        const items = await base44.asServiceRole.entities.PayoutItem.filter({ payoutId: p.id });
        if (!items?.length) {
          const existing = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ entityId: p.id, issueType: 'PAYOUT_NO_ITEMS', resolved: false });
          if (!existing?.length) {
            const issue = await createIssue(base44, 'PAYOUT_NO_ITEMS', 'Payout', p.id,
              `Payout ${p.id} has no PayoutItem records`, 'medium');
            issues.push(issue);
          }
        }
      }
    });

    // 5. DUPLICATE ACTIVE RESERVATIONS ON SAME UNIT
    await safeCheck('duplicate_reservations', async () => {
      const active = await base44.asServiceRole.entities.Reservation.filter({ status: 'active' });
      const unitMap = {};
      for (const res of (active || [])) {
        const bundles = await base44.asServiceRole.entities.ReservationBundle.filter({ id: res.bundleId });
        const unitId = bundles?.[0]?.unitId;
        if (!unitId) continue;
        if (!unitMap[unitId]) unitMap[unitId] = [];
        unitMap[unitId].push(res.id);
      }
      for (const [unitId, resIds] of Object.entries(unitMap)) {
        if (resIds.length > 1) {
          const existing = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ entityId: unitId, issueType: 'DUPLICATE_ACTIVE_RESERVATIONS', resolved: false });
          if (!existing?.length) {
            const issue = await createIssue(base44, 'DUPLICATE_ACTIVE_RESERVATIONS', 'SaleUnit', unitId,
              `Unit ${unitId} has ${resIds.length} active reservations: ${resIds.join(', ')}`, 'critical');
            issues.push(issue);
          }
        }
      }
    });

    // 6. APPROVED PAYOUT WHERE COMMISSION STATUS != paid
    await safeCheck('payout_commission_mismatch', async () => {
      const paidPayouts = await base44.asServiceRole.entities.Payout.filter({ status: 'paid' });
      for (const p of (paidPayouts || []).slice(0, 30)) {
        const items = await base44.asServiceRole.entities.PayoutItem.filter({ payoutId: p.id });
        for (const item of (items || [])) {
          const comms = await base44.asServiceRole.entities.Commission.filter({ id: item.commissionId });
          const c = comms?.[0];
          if (c && c.managerPayoutStatus !== 'paid') {
            const existing = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ entityId: item.commissionId, issueType: 'PAYOUT_COMMISSION_MISMATCH', resolved: false });
            if (!existing?.length) {
              const issue = await createIssue(base44, 'PAYOUT_COMMISSION_MISMATCH', 'Commission', item.commissionId,
                `Payout ${p.id} is 'paid' but commission ${item.commissionId} managerPayoutStatus='${c.managerPayoutStatus}'`, 'high');
              issues.push(issue);
            }
          }
        }
      }
    });

    // Log summary
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'DATA_INTEGRITY_CHECK_RUN',
      performedByUserId: 'system',
      performedByName: 'Integrity Monitor',
      details: JSON.stringify({ issuesFound: issues.length, checkedAt })
    });

    return Response.json({ success: true, checkedAt, issuesFound: issues.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});