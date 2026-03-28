import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SALES_AGENT, SALES_MANAGER, ADMINISTRATOR can extend
    if (!['SALES_AGENT', 'SALES_MANAGER', 'ADMINISTRATOR'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { reservationId, newExpiresAt } = body;

    const reservation = await base44.entities.Reservation.filter({ id: reservationId }).then(r => r?.[0]);
    if (!reservation) {
      return Response.json({ error: 'Rezervacija nerasta' }, { status: 400 });
    }

    // Update reservation
    const newStatus = new Date(newExpiresAt) > new Date() ? 'active' : 'overdue';
    await base44.entities.Reservation.update(reservationId, {
      expiresAt: newExpiresAt,
      status: newStatus
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});