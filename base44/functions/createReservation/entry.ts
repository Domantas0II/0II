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

    // === STAGE 1: FULL VALIDATION ===
    
    // Validate required fields
    if (!projectId || !bundleId || !clientId || !clientProjectInterestId) {
      return Response.json({ error: 'Privalomi duomenys trūksta' }, { status: 400 });
    }

    // Validate project exists
    const project = await base44.entities.Project.filter({ id: projectId }).then(r => r?.[0]);
    if (!project) {
      return Response.json({ error: 'Projektas nerastas' }, { status: 400 });
    }

    // Validate client exists
    const client = await base44.entities.Client.filter({ id: clientId }).then(r => r?.[0]);
    if (!client) {
      return Response.json({ error: 'Klientas nerastas' }, { status: 400 });
    }

    // Validate clientProjectInterest exists and belongs to project
    const interest = await base44.entities.ClientProjectInterest.filter({ id: clientProjectInterestId }).then(r => r?.[0]);
    if (!interest) {
      return Response.json({ error: 'Kliento susidomėjimas nerastas' }, { status: 400 });
    }
    if (interest.projectId !== projectId) {
      return Response.json({ error: 'Kliento susidomėjimas nepriklauso projektui' }, { status: 400 });
    }
    if (interest.clientId !== clientId) {
      return Response.json({ error: 'Kliento susidomėjimas nepriklauso šiam klientui' }, { status: 400 });
    }

    // Validate bundle exists and matches project
    const bundle = await base44.entities.ReservationBundle.filter({ id: bundleId }).then(r => r?.[0]);
    if (!bundle) {
      return Response.json({ error: 'Pluoštas nerastas' }, { status: 400 });
    }
    if (bundle.projectId !== projectId) {
      return Response.json({ error: 'Pluoštas nepriklauso projektui' }, { status: 400 });
    }

    // === STAGE 2: FRESH UNIT + COMPONENTS FETCH (Race condition check) ===
    
    // Get fresh unit from DB
    const unit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
    if (!unit) {
      return Response.json({ error: 'Objektas nerastas' }, { status: 400 });
    }
    if (unit.projectId !== projectId) {
      return Response.json({ error: 'Objektas nepriklauso projektui' }, { status: 400 });
    }

    // Critical: Check unit status MUST be available (race condition protection)
    if (unit.internalStatus !== 'available') {
      return Response.json({ 
        error: `Objektas jau ${unit.internalStatus}. Gali būti, kad kitas agentas jį rezervavo.`,
        code: 'UNIT_UNAVAILABLE'
      }, { status: 409 });
    }

    // Get fresh components
    const components = bundle.componentIds?.length > 0
      ? await base44.entities.UnitComponent.filter({ id: { $in: bundle.componentIds } })
      : [];

    // Validate all components
    if (components.length !== (bundle.componentIds?.length || 0)) {
      return Response.json({ error: 'Viena iš dedamųjų nerasta' }, { status: 400 });
    }

    for (const comp of components) {
      if (comp.projectId !== projectId) {
        return Response.json({ error: `Dedamoji ${comp.label} nepriklauso projektui` }, { status: 400 });
      }
      if (comp.status !== 'available') {
        return Response.json({ 
          error: `Dedamoji ${comp.label} jau ${comp.status}`,
          code: 'COMPONENT_UNAVAILABLE'
        }, { status: 409 });
      }
    }

    // Check for conflicting active/overdue reservations
    const conflicts = await base44.entities.Reservation.filter({
      projectId,
      status: { $in: ['active', 'overdue'] }
    });

    for (const res of conflicts) {
      const conflictBundle = await base44.entities.ReservationBundle.filter({ id: res.bundleId }).then(r => r?.[0]);
      if (conflictBundle?.unitId === bundle.unitId) {
        return Response.json({ 
          error: 'Objektas jau rezervuotas',
          code: 'UNIT_RESERVED'
        }, { status: 409 });
      }
      if (conflictBundle?.componentIds?.some(cid => bundle.componentIds?.includes(cid))) {
        return Response.json({ 
          error: 'Viena iš dedamųjų jau rezervuota',
          code: 'COMPONENT_RESERVED'
        }, { status: 409 });
      }
    }

    // === STAGE 3: CREATE RESERVATION + UPDATE STATUSES WITH ROLLBACK ===

    let createdReservationId = null;
    try {
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
      createdReservationId = reservation.id;

      // Update unit status
      await base44.entities.SaleUnit.update(bundle.unitId, {
        internalStatus: 'reserved'
      });

      // Update component statuses (with error handling)
      const failedComponents = [];
      if (bundle.componentIds?.length > 0) {
        for (const compId of bundle.componentIds) {
          try {
            await base44.entities.UnitComponent.update(compId, {
              status: 'reserved'
            });
          } catch (err) {
            failedComponents.push(compId);
          }
        }
      }

      // If any component update failed, rollback
      if (failedComponents.length > 0) {
        // Rollback: mark as released
        await base44.entities.Reservation.update(createdReservationId, {
          status: 'released',
          releasedAt: new Date().toISOString()
        });
        // Rollback unit
        await base44.entities.SaleUnit.update(bundle.unitId, {
          internalStatus: 'available'
        });
        // Rollback updated components
        for (const compId of bundle.componentIds) {
          if (!failedComponents.includes(compId)) {
            await base44.entities.UnitComponent.update(compId, {
              status: 'available'
            });
          }
        }
        return Response.json({ 
          error: 'Nepavyko užrakinti visų rezervacijos dalių',
          code: 'PARTIAL_FAILURE'
        }, { status: 500 });
      }

      // === STAGE 4: AUDIT LOG ===
      try {
        await base44.entities.AuditLog.create({
          action: 'RESERVATION_CREATED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          targetUserId: clientId,
          targetUserEmail: client.email,
          details: JSON.stringify({
            reservationId: createdReservationId,
            unitId: bundle.unitId,
            componentCount: bundle.componentIds?.length || 0,
            expiresAt
          })
        });
      } catch {
        // Audit log failure should not block reservation
      }

      return Response.json({
        success: true,
        reservationId: createdReservationId
      });

    } catch (error) {
      // Rollback if something failed
      if (createdReservationId) {
        try {
          await base44.entities.Reservation.update(createdReservationId, {
            status: 'released',
            releasedAt: new Date().toISOString()
          });
        } catch {
          // Best effort cleanup
        }
      }
      throw error;
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});