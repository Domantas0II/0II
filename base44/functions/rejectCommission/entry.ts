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

    const { commissionId, reason } = await req.json();
    if (!commissionId) return Response.json({ error: 'commissionId required' }, { status: 400 });

    const commissions = await base44.asServiceRole.entities.Commission.filter({ id: commissionId });
    if (!commissions || commissions.length === 0) return Response.json({ error: 'Commission not found' }, { status: 404 });

    const commission = commissions[0];
    if (!['pending', 'approved'].includes(commission.status)) {
      return Response.json({ error: `Cannot reject commission with status: ${commission.status}` }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Commission.update(commissionId, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedByUserId: user.id,
      rejectionReason: reason || ''
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'COMMISSION_REJECTED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ commissionId, dealId: commission.dealId, reason: reason || '' })
    });

    return Response.json({ success: true, commission: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});