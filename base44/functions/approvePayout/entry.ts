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
    if (payout.status !== 'draft') {
      return Response.json({ error: `Cannot approve payout with status: ${payout.status}` }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Payout.update(payoutId, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedByUserId: user.id
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'PAYOUT_APPROVED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ payoutId, userId: payout.userId, totalAmount: payout.totalAmount })
    });

    return Response.json({ success: true, payout: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});