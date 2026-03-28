import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    // This is a system cron function - no user role check needed
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Get all active reservations
    const activeReservations = await base44.entities.Reservation.filter({
      status: 'active'
    });

    let updatedCount = 0;
    for (const reservation of activeReservations) {
      if (new Date(reservation.expiresAt) < now) {
        await base44.entities.Reservation.update(reservation.id, {
          status: 'overdue'
        });
        updatedCount++;
      }
    }

    return Response.json({
      success: true,
      updatedCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});