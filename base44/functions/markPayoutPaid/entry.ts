import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (normalizeRole(user.role) !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Forbidden: Admin required' }, { status: 403 });
    }

    const { payoutId } = await req.json();
    if (!payoutId) return Response.json({ error: 'payoutId required' }, { status: 400 });

    const payouts = await base44.asServiceRole.entities.Payout.filter({ id: payoutId });
    if (!payouts || payouts.length === 0) return Response.json({ error: 'Payout not found' }, { status: 404 });

    const payout = payouts[0];
    if (payout.status !== 'approved') {
      return Response.json({ error: `Cannot mark paid: payout status is ${payout.status}` }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Mark payout as paid
    const updated = await base44.asServiceRole.entities.Payout.update(payoutId, {
      status: 'paid',
      paidAt: now
    });

    // Fetch all PayoutItems for this payout
    const items = await base44.asServiceRole.entities.PayoutItem.filter({ payoutId });

    // Mark all linked commissions as paid — batch
    const paidPromises = (items || []).map(item =>
      base44.asServiceRole.entities.Commission.update(item.commissionId, {
        status: 'paid',
        paidAt: now
      })
    );
    await Promise.all(paidPromises);

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'PAYOUT_PAID',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ payoutId, userId: payout.userId, totalAmount: payout.totalAmount, commissionsCount: items?.length || 0 })
    });

    return Response.json({ success: true, payout: updated, commissionsMarkedPaid: items?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});