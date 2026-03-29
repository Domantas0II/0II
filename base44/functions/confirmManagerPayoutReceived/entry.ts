import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { commissionId } = await req.json();
    if (!commissionId) return Response.json({ error: 'commissionId required' }, { status: 400 });

    const commissions = await base44.asServiceRole.entities.Commission.filter({ id: commissionId });
    if (!commissions?.length) return Response.json({ error: 'Commission not found' }, { status: 404 });
    const commission = commissions[0];

    // Only the manager who owns it, or admin/manager override
    const role = normalizeRole(user.role);
    const isOwner = commission.userId === user.id;
    const isAdminOrManager = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);
    if (!isOwner && !isAdminOrManager) {
      return Response.json({ error: 'Forbidden: only the commission owner or admin/manager can confirm receipt' }, { status: 403 });
    }

    if (commission.managerPayoutStatus !== 'paid') {
      return Response.json({ error: `Cannot confirm receipt: managerPayoutStatus is '${commission.managerPayoutStatus}'. Must be 'paid'.` }, { status: 400 });
    }

    if (commission.managerPayoutReceivedConfirmedAt) {
      return Response.json({ error: 'Already confirmed' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updated = await base44.asServiceRole.entities.Commission.update(commissionId, {
      managerPayoutReceivedConfirmedAt: now,
      managerPayoutReceivedConfirmedByUserId: user.id
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'MANAGER_PAYOUT_RECEIVED_CONFIRMED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ commissionId, dealId: commission.dealId })
    });

    return Response.json({ success: true, commission: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});