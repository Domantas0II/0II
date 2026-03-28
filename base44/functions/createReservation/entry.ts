import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      projectId,
      bundleId,
      clientId,
      clientProjectInterestId,
      expiresAt,
      notes
    } = body;

    // Validate bundle exists and matches project
    const bundle = await base44.entities.ReservationBundle.filter({ id: bundleId }).then(r => r?.[0]);
    if (!bundle) {
      return Response.json({ error: 'Pluoštas nerastas' }, { status: 400 });
    }
    if (bundle.projectId !== projectId) {
      return Response.json({ error: 'Pluoštas nepriklauso projektui' }, { status: 400 });
    }

    // Validate unit status
    const unit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
    if (['reserved', 'sold', 'developer_reserved', 'withheld'].includes(unit.internalStatus)) {
      return Response.json({ error: 'Objektas nebegalima rezervuoti' }, { status: 400 });
    }

    // Create reservation
    const reservation = await base44.entities.Reservation.create({
      projectId,
      bundleId,
      clientId,
      clientProjectInterestId,
      reservedByUserId: user.id,
      status: 'active',
      reservedAt: new Date().toISOString(),
      expiresAt,
      notes
    });

    // Update unit status
    await base44.entities.SaleUnit.update(bundle.unitId, {
      internalStatus: 'reserved'
    });

    // Update component statuses
    if (bundle.componentIds?.length > 0) {
      for (const compId of bundle.componentIds) {
        await base44.entities.UnitComponent.update(compId, {
          status: 'reserved'
        });
      }
    }

    return Response.json({
      success: true,
      reservationId: reservation.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});