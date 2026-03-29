import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, periodStart, periodEnd } = await req.json();
    if (!userId || !periodStart || !periodEnd) {
      return Response.json({ error: 'userId, periodStart, periodEnd required' }, { status: 400 });
    }

    // Fetch all approved commissions for user, not yet assigned to a payout
    const allApproved = await base44.asServiceRole.entities.Commission.filter({
      userId,
      status: 'approved'
    });

    // Filter: not yet in a payout, within period
    const eligible = (allApproved || []).filter(c => {
      if (c.payoutId) return false;
      const calcDate = new Date(c.calculatedAt);
      return calcDate >= new Date(periodStart) && calcDate <= new Date(periodEnd);
    });

    if (eligible.length === 0) {
      return Response.json({ error: 'No eligible approved commissions found for this period' }, { status: 400 });
    }

    // Calculate totals
    const totalAmount = eligible.reduce((sum, c) => sum + c.amount, 0);
    const totalVat = eligible.reduce((sum, c) => sum + c.vatAmount, 0);
    const totalWithoutVat = eligible.reduce((sum, c) => sum + c.amountWithoutVat, 0);

    // Fetch user name
    const users = await base44.asServiceRole.entities.User.filter({ id: userId });
    const userName = users?.[0]?.full_name || userId;

    // Create Payout
    const payout = await base44.asServiceRole.entities.Payout.create({
      userId,
      userName,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalWithoutVat: Math.round(totalWithoutVat * 100) / 100,
      status: 'draft',
      periodStart,
      periodEnd,
      itemCount: eligible.length,
      createdByUserId: user.id
    });

    // Create PayoutItems and update Commissions — batch
    const itemPromises = eligible.map(c =>
      base44.asServiceRole.entities.PayoutItem.create({
        payoutId: payout.id,
        commissionId: c.id,
        amount: c.amount,
        vatAmount: c.vatAmount,
        amountWithoutVat: c.amountWithoutVat
      })
    );
    const updatePromises = eligible.map(c =>
      base44.asServiceRole.entities.Commission.update(c.id, { payoutId: payout.id })
    );

    await Promise.all([...itemPromises, ...updatePromises]);

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'PAYOUT_CREATED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ payoutId: payout.id, userId, itemCount: eligible.length, totalAmount: payout.totalAmount })
    });

    return Response.json({ success: true, payout, itemCount: eligible.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});