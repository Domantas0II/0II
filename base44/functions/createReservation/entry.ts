import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Helper: generate unique lock token
function generateLockToken() {
  return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: check if lock is stale (older than 2 minutes)
function isLockStale(lockAt) {
  if (!lockAt) return false;
  const lockTime = new Date(lockAt);
  const now = new Date();
  const ageMs = now - lockTime;
  return ageMs > 2 * 60 * 1000; // 2 minutes
}

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
    
    if (!projectId || !bundleId || !clientId || !clientProjectInterestId) {
      return Response.json({ error: 'Privalomi duomenys trūksta' }, { status: 400 });
    }

    const project = await base44.entities.Project.filter({ id: projectId }).then(r => r?.[0]);
    if (!project) {
      return Response.json({ error: 'Projektas nerastas' }, { status: 400 });
    }

    const client = await base44.entities.Client.filter({ id: clientId }).then(r => r?.[0]);
    if (!client) {
      return Response.json({ error: 'Klientas nerastas' }, { status: 400 });
    }

    const interest = await base44.entities.ClientProjectInterest.filter({ id: clientProjectInterestId }).then(r => r?.[0]);
    if (!interest || interest.projectId !== projectId || interest.clientId !== clientId) {
      return Response.json({ error: 'Kliento susidomėjimas nepriklauso šiam projektui/klientui' }, { status: 400 });
    }

    // === STAGE 2: FRESH FETCH + BUNDLE STALENESS CHECK ===
    
    const bundle = await base44.entities.ReservationBundle.filter({ id: bundleId }).then(r => r?.[0]);
    if (!bundle || bundle.projectId !== projectId) {
      return Response.json({ 
        error: 'Rezervacijos bundle nebegalioja arba nepriklauso projektui',
        code: 'BUNDLE_INVALID'
      }, { status: 400 });
    }

    let unit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
    if (!unit || unit.projectId !== projectId) {
      return Response.json({ error: 'Objektas nerastas arba nepriklauso projektui' }, { status: 400 });
    }

    // === STAGE 3: PRE-LOCK VALIDATION ===
    
    // Check for stale locks (staleness safety)
    if (unit.reservationLockToken && !isLockStale(unit.reservationLockAt)) {
      return Response.json({ 
        error: 'Objektas ką tik buvo rezervuotas kito vartotojo',
        code: 'UNIT_LOCKED'
      }, { status: 409 });
    }

    // Check unit is available
    if (unit.internalStatus !== 'available') {
      return Response.json({ 
        error: `Objektas jau ${unit.internalStatus}. Gali būti, kad kitas agentas jį rezervavo.`,
        code: 'UNIT_UNAVAILABLE'
      }, { status: 409 });
    }

    // Validate components exist and are available
    const components = bundle.componentIds?.length > 0
      ? await base44.entities.UnitComponent.filter({ id: { $in: bundle.componentIds } })
      : [];

    if (components.length !== (bundle.componentIds?.length || 0)) {
      return Response.json({ error: 'Viena iš dedamųjų nerasta arba buvo ištrinta' }, { status: 400 });
    }

    for (const comp of components) {
      if (comp.projectId !== projectId) {
        return Response.json({ error: `Dedamoji ${comp.label} nepriklauso projektui` }, { status: 400 });
      }
      if (comp.status !== 'available') {
        return Response.json({ 
          error: `Viena iš dedamųjų jau ${comp.status}`,
          code: 'COMPONENT_UNAVAILABLE'
        }, { status: 409 });
      }
    }

    // Check no active/overdue reservations exist for this unit/components
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

    // === STAGE 4: CLAIM LOCK ===
    
    const lockToken = generateLockToken();
    const lockAt = new Date().toISOString();

    try {
      await base44.entities.SaleUnit.update(bundle.unitId, {
        reservationLockToken: lockToken,
        reservationLockAt: lockAt
      });
    } catch (err) {
      return Response.json({ 
        error: 'Nepavyko užrakinti objekto rezervacijai',
        code: 'LOCK_FAILED'
      }, { status: 500 });
    }

    // === STAGE 5: POST-LOCK RE-VALIDATION ===
    
    unit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
    
    // Verify we hold the lock
    if (unit.reservationLockToken !== lockToken) {
      return Response.json({ 
        error: 'Objektas ką tik buvo rezervuotas kito vartotojo',
        code: 'LOCK_STOLEN'
      }, { status: 409 });
    }

    // Re-check components after lock claim
    const componentsAfterLock = bundle.componentIds?.length > 0
      ? await base44.entities.UnitComponent.filter({ id: { $in: bundle.componentIds } })
      : [];

    for (const comp of componentsAfterLock) {
      if (comp.status !== 'available') {
        // Release lock before failing
        await base44.entities.SaleUnit.update(bundle.unitId, {
          reservationLockToken: null,
          reservationLockAt: null
        });
        return Response.json({ 
          error: 'Viena iš dedamųjų jau nebeprieinama',
          code: 'COMPONENT_UNAVAILABLE_POST_LOCK'
        }, { status: 409 });
      }
    }

    // === STAGE 6: CREATE RESERVATION + UPDATE STATUSES ===
    
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

      // Update unit status and release lock
      await base44.entities.SaleUnit.update(bundle.unitId, {
        internalStatus: 'reserved',
        reservationLockToken: null,
        reservationLockAt: null
      });

      // Update component statuses
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

      // If component update failed, rollback
      if (failedComponents.length > 0) {
        await base44.entities.Reservation.update(createdReservationId, {
          status: 'released',
          releasedAt: new Date().toISOString()
        });
        await base44.entities.SaleUnit.update(bundle.unitId, {
          internalStatus: 'available'
        });
        for (const compId of bundle.componentIds) {
          if (!failedComponents.includes(compId)) {
            await base44.entities.UnitComponent.update(compId, {
              status: 'available'
            });
          }
        }
        return Response.json({ 
          error: 'Nepavyko saugiai užbaigti rezervacijos',
          code: 'PARTIAL_FAILURE'
        }, { status: 500 });
      }

      // === STAGE 7: FINAL VALIDATION ===
      
      // Verify only one active reservation exists for this unit
      const finalCheck = await base44.entities.Reservation.filter({
        projectId,
        status: 'active'
      });

      const unitReservations = finalCheck.filter(r => {
        const b = bundle;
        return b.unitId === bundle.unitId;
      });

      if (unitReservations.length > 1) {
        // ANOMALY: Multiple active reservations detected
        await base44.entities.Reservation.update(createdReservationId, {
          status: 'released',
          releasedAt: new Date().toISOString()
        });
        return Response.json({ 
          error: 'Nepavyko saugiai užbaigti rezervacijos - anomalija',
          code: 'ANOMALY_DETECTED'
        }, { status: 500 });
      }

      // === STAGE 8: AUDIT LOG ===
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
            expiresAt,
            lockToken: lockToken
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
      // Rollback on creation failure
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

      // Release lock
      try {
        await base44.entities.SaleUnit.update(bundle.unitId, {
          reservationLockToken: null,
          reservationLockAt: null
        });
      } catch {
        // Log lock release failure but don't block error return
      }

      // Log concurrency audit
      try {
        await base44.entities.AuditLog.create({
          action: 'RESERVATION_FAILED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          targetUserId: clientId,
          details: JSON.stringify({
            error: error.message,
            bundleId,
            unitId: bundle.unitId
          })
        });
      } catch {
        // Audit failure non-critical
      }

      throw error;
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});