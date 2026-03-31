import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * validateSalesChain — Global Data Integrity Check
 *
 * Tikrina:
 * - Agreement be Reservation → ERROR
 * - Deal be Agreement → ERROR
 * - Commission be Deal → ERROR
 * - Reservation expired + has Agreement → WARNING
 *
 * Kiekvieną rastą problemą įrašo į DataIntegrityIssue.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[user.role] || user.role);
    if (role !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const issues = [];
    const now = new Date().toISOString();

    // === 1. Agreements be Reservation ===
    const agreements = await base44.asServiceRole.entities.Agreement.list();
    const reservationIds = new Set();
    const allReservations = await base44.asServiceRole.entities.Reservation.list();
    allReservations.forEach(r => reservationIds.add(r.id));

    for (const ag of agreements) {
      if (!ag.reservationId || !reservationIds.has(ag.reservationId)) {
        issues.push({
          issueType: 'AGREEMENT_NO_RESERVATION',
          entityType: 'Agreement',
          entityId: ag.id,
          description: `Agreement ${ag.id} neturi galiojančios rezervacijos (reservationId: ${ag.reservationId})`,
          severity: 'critical',
          detectedAt: now,
          resolved: false
        });
      }
    }

    // === 2. Deals be Agreement ===
    const deals = await base44.asServiceRole.entities.Deal.list();
    const agreementIds = new Set(agreements.map(a => a.id));
    const signedAgreementIds = new Set(agreements.filter(a => a.status === 'signed').map(a => a.id));

    for (const deal of deals) {
      if (!deal.agreementId || !agreementIds.has(deal.agreementId)) {
        issues.push({
          issueType: 'DEAL_NO_AGREEMENT',
          entityType: 'Deal',
          entityId: deal.id,
          description: `Deal ${deal.id} neturi susietos sutarties (agreementId: ${deal.agreementId})`,
          severity: 'critical',
          detectedAt: now,
          resolved: false
        });
      } else if (!signedAgreementIds.has(deal.agreementId)) {
        issues.push({
          issueType: 'DEAL_AGREEMENT_NOT_SIGNED',
          entityType: 'Deal',
          entityId: deal.id,
          description: `Deal ${deal.id} sutartis ${deal.agreementId} nėra pasirašyta`,
          severity: 'high',
          detectedAt: now,
          resolved: false
        });
      }
    }

    // === 3. Commissions be Deal ===
    const commissions = await base44.asServiceRole.entities.Commission.list();
    const dealIds = new Set(deals.map(d => d.id));

    for (const comm of commissions) {
      if (!comm.dealId || !dealIds.has(comm.dealId)) {
        issues.push({
          issueType: 'COMMISSION_NO_DEAL',
          entityType: 'Commission',
          entityId: comm.id,
          description: `Commission ${comm.id} neturi susieto Deal (dealId: ${comm.dealId})`,
          severity: 'critical',
          detectedAt: now,
          resolved: false
        });
      }
    }

    // === 4. Deals be Commission (>24h seno) ===
    const commissionDealIds = new Set(commissions.map(c => c.dealId));
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const deal of deals) {
      if (!commissionDealIds.has(deal.id) && deal.created_date < cutoff) {
        issues.push({
          issueType: 'DEAL_NO_COMMISSION',
          entityType: 'Deal',
          entityId: deal.id,
          description: `Deal ${deal.id} neturi komisinio įrašo (>24h)`,
          severity: 'high',
          detectedAt: now,
          resolved: false
        });
      }
    }

    // === 5. Reservation expired + has signed Agreement but no Deal ===
    const reservationMap = Object.fromEntries(allReservations.map(r => [r.id, r]));
    const dealReservationIds = new Set(deals.map(d => d.reservationId));

    for (const ag of agreements) {
      if (ag.status !== 'signed') continue;
      const res = reservationMap[ag.reservationId];
      if (!res) continue;
      const expired = res.status === 'released' || (new Date(res.expiresAt) < new Date() && res.status !== 'converted');
      if (expired && !dealReservationIds.has(res.id)) {
        issues.push({
          issueType: 'RESERVATION_EXPIRED_WITH_AGREEMENT_NO_DEAL',
          entityType: 'Reservation',
          entityId: res.id,
          description: `Rezervacija ${res.id} pasibaigusi arba atleista, turi pasirašytą sutartį ${ag.id}, bet nėra Deal`,
          severity: 'high',
          detectedAt: now,
          resolved: false
        });
      }
    }

    // === Persist new issues (skip duplicates by entityId+issueType) ===
    const existing = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ resolved: false });
    const existingKeys = new Set(existing.map(e => `${e.issueType}:${e.entityId}`));

    let created = 0;
    for (const issue of issues) {
      const key = `${issue.issueType}:${issue.entityId}`;
      if (!existingKeys.has(key)) {
        await base44.asServiceRole.entities.DataIntegrityIssue.create(issue).catch(() => {});
        created++;
      }
    }

    return Response.json({
      success: true,
      totalFound: issues.length,
      newIssues: created,
      issues: issues.map(i => ({ type: i.issueType, entityId: i.entityId, severity: i.severity }))
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});