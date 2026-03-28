import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMINISTRATOR and SALES_MANAGER can release
    if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { reservationId } = body;

    const reservation = await base44.entities.Reservation.filter({ id: reservationId }).then(r => r?.[0]);
    if (!reservation) {
      return Response.json({ error: 'Rezervacija nerasta' }, { status: 400 });
    }

    // Validate reservation can be released
    if (!['active', 'overdue'].includes(reservation.status)) {
      return Response.json({ 
        error: `Rezervaciją kurios statusas ${reservation.status} negalima atleisti`,
        code: 'INVALID_STATUS'
      }, { status: 400 });
    }

    // Get bundle
    const bundle = await base44.entities.ReservationBundle.filter({ id: reservation.bundleId }).then(r => r?.[0]);
    if (!bundle) {
      return Response.json({ error: 'Pluoštas nerastas' }, { status: 400 });
    }

    // Update reservation
    await base44.entities.Reservation.update(reservationId, {
      status: 'released',
      releasedAt: new Date().toISOString()
    });

    // Release unit
    await base44.entities.SaleUnit.update(bundle.unitId, {
      internalStatus: 'available'
    });

    // Release components
    if (bundle.componentIds?.length > 0) {
      for (const compId of bundle.componentIds) {
        await base44.entities.UnitComponent.update(compId, {
          status: 'available'
        });
      }
    }

    // === AUDIT LOG ===
    try {
      const client = await base44.entities.Client.filter({ id: reservation.clientId }).then(r => r?.[0]);
      await base44.entities.AuditLog.create({
        action: 'RESERVATION_RELEASED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        targetUserId: reservation.clientId,
        targetUserEmail: client?.email,
        details: JSON.stringify({
          reservationId,
          bundleId: bundle.id
        })
      });
    } catch {
      // Audit log failure should not block release
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});