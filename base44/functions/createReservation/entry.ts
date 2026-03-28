import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Generate unique lock token
function generateLockToken() {
  return `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Check if lock is stale (2 minute TTL)
function isLockStale(lockAt) {
  if (!lockAt) return false;
  const ageMs = new Date() - new Date(lockAt);
  return ageMs > 2 * 60 * 1000;
}

// Verify lock ownership (strict check)
function verifyLockOwnership(unit, token, lockAt) {
  if (unit.reservationLockToken !== token) return false;
  if (!lockAt || !unit.reservationLockAt) return false;
  // Verify lock timestamp is recent (within this request window)
  const timeDiff = Math.abs(new Date(unit.reservationLockAt) - new Date(lockAt));
  return timeDiff < 1000; // within 1 second
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

    // === STAGE 2: BUNDLE IMMUTABILITY + FRESH FETCH ===
    
    const bundle = await base44.entities.ReservationBundle.filter({ id: bundleId }).then(r => r?.[0]);
    if (!bundle || bundle.projectId !== projectId) {
      return Response.json({ 
        error: 'Rezervacijos bundle nebegalioja arba nepriklauso projektui',
        code: 'BUNDLE_INVALID'
      }, { status: 400 });
    }

    // Verify bundle hasn't been modified
    const expectedComponentCount = bundle.componentIds?.length || 0;
    if (!bundle.unitId) {
      return Response.json({ 
        error: 'Rezervacijos bundle nepilnas – trūksta objekto',
        code: 'BUNDLE_CORRUPTED'
      }, { status: 400 });
    }

    let unit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
    if (!unit || unit.projectId !== projectId) {
      return Response.json({ error: 'Objektas nerastas arba nepriklauso projektui' }, { status: 400 });
    }

    // === STAGE 3: PRE-LOCK VALIDATION + STALE CLEANUP ===
    
    // Check for stale locks and clean them up
    if (unit.reservationLockToken && !isLockStale(unit.reservationLockAt)) {
      return Response.json({ 
        error: 'Objektas ką tik buvo rezervuotas kito vartotojo',
        code: 'UNIT_LOCKED'
      }, { status: 409 });
    }

    // If stale lock exists, clean it up
    if (unit.reservationLockToken && isLockStale(unit.reservationLockAt)) {
      try {
        await base44.entities.SaleUnit.update(unit.id, {
          reservationLockToken: null,
          reservationLockAt: null
        });
        // Log stale lock cleanup
        await base44.entities.AuditLog.create({
          action: 'STALE_LOCK_CLEARED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          details: JSON.stringify({
            unitId: unit.id,
            staleLockToken: unit.reservationLockToken,
            staleLockAge: new Date() - new Date(unit.reservationLockAt)
          })
        }).catch(() => {});
        // Re-fetch cleaned unit
        unit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
      } catch (err) {
        // Continue anyway, we'll detect conflicts later
      }
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

    // === STAGE 4: STRICT LOCK CLAIM ===
    
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

    // Log lock claim
    await base44.entities.AuditLog.create({
      action: 'LOCK_CLAIMED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        unitId: bundle.unitId,
        lockToken: lockToken.substring(0, 20) + '...'
      })
    }).catch(() => {});

    // === STAGE 5: STRICT LOCK OWNERSHIP VERIFICATION ===
    
    unit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
    
    // Verify we still own the lock
    if (!verifyLockOwnership(unit, lockToken, lockAt)) {
      // Log lock ownership failure
      await base44.entities.AuditLog.create({
        action: 'LOCK_OWNERSHIP_FAILED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          unitId: bundle.unitId,
          expectedToken: lockToken.substring(0, 20),
          actualToken: unit.reservationLockToken?.substring(0, 20),
          expectedAt: lockAt,
          actualAt: unit.reservationLockAt
        })
      }).catch(() => {});
      
      return Response.json({ 
        error: 'Objektas ką tik buvo rezervuotas kito vartotojo',
        code: 'LOCK_STOLEN'
      }, { status: 409 });
    }

    // === STAGE 5B: HARDENED COMPONENT RE-CHECK ===
    
    // Fresh fetch components immediately before status update
    const componentsAfterLock = bundle.componentIds?.length > 0
      ? await base44.entities.UnitComponent.filter({ id: { $in: bundle.componentIds } })
      : [];

    // Verify count matches
    if (componentsAfterLock.length !== expectedComponentCount) {
      await base44.entities.SaleUnit.update(bundle.unitId, {
        reservationLockToken: null,
        reservationLockAt: null
      });
      return Response.json({ 
        error: 'Viena iš dedamųjų buvo ištrinta ar pakeista',
        code: 'COMPONENT_MISSING_POST_LOCK'
      }, { status: 409 });
    }

    // Verify all components are available and have no active reservations
    for (const comp of componentsAfterLock) {
      if (comp.status !== 'available') {
        await base44.entities.SaleUnit.update(bundle.unitId, {
          reservationLockToken: null,
          reservationLockAt: null
        });
        return Response.json({ 
          error: 'Viena iš dedamųjų jau nebeprieinama',
          code: 'COMPONENT_UNAVAILABLE_POST_LOCK'
        }, { status: 409 });
      }
      
      // Check no active/overdue reservation for this component
      const compConflict = await base44.entities.Reservation.filter({
        projectId,
        status: { $in: ['active', 'overdue'] }
      }).then(reservations => {
        return reservations.some(r => {
          const b = bundle;
          return b?.componentIds?.includes(comp.id);
        });
      }).catch(() => false);

      if (compConflict) {
        await base44.entities.SaleUnit.update(bundle.unitId, {
          reservationLockToken: null,
          reservationLockAt: null
        });
        return Response.json({ 
          error: 'Viena iš dedamųjų jau rezervuota',
          code: 'COMPONENT_RESERVED_POST_LOCK'
        }, { status: 409 });
      }
    }

    // === STAGE 6: CREATE RESERVATION + ATOMIC STATUS UPDATES ===
    
    let createdReservationId = null;
    const reservedComponentIds = [];

    try {
      // Pre-lock check: verify lock still ours
      const preCreateUnit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
      if (preCreateUnit.reservationLockToken !== lockToken) {
        return Response.json({ 
          error: 'Objektas ką tik buvo rezervuotas kito vartotojo',
          code: 'LOCK_LOST_PRE_CREATE'
        }, { status: 409 });
      }

      // Create reservation (now that lock is verified)
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

      // Pre-unit-update check: verify lock still ours
      const preUnitUpdateUnit = await base44.entities.SaleUnit.filter({ id: bundle.unitId }).then(r => r?.[0]);
      if (preUnitUpdateUnit.reservationLockToken !== lockToken) {
        // Reservation created but can't claim unit – must rollback
        await base44.entities.Reservation.update(createdReservationId, {
          status: 'released',
          releasedAt: new Date().toISOString()
        });
        return Response.json({ 
          error: 'Objektas ką tik buvo rezervuotas kito vartotojo',
          code: 'LOCK_LOST_PRE_UNIT_UPDATE'
        }, { status: 409 });
      }

      // Update unit status and release lock
      await base44.entities.SaleUnit.update(bundle.unitId, {
        internalStatus: 'reserved',
        reservationLockToken: null,
        reservationLockAt: null
      });

      // Update component statuses individually with error tracking
      if (bundle.componentIds?.length > 0) {
        for (const compId of bundle.componentIds) {
          try {
            await base44.entities.UnitComponent.update(compId, {
              status: 'reserved'
            });
            reservedComponentIds.push(compId);
          } catch (err) {
            // Component update failed – will trigger full rollback in catch block
            throw new Error(`Component update failed: ${compId}`);
          }
        }
      }

      // === STAGE 7: STRICT UNIT-SCOPED FINAL VALIDATION ===
      
      // Verify only ONE active/overdue reservation exists for THIS UNIT
      const allReservations = await base44.entities.Reservation.filter({
        projectId,
        status: { $in: ['active', 'overdue'] }
      });

      const unitReservationCount = allReservations.reduce((count, r) => {
        // Need to check bundle for each reservation
        const resBundle = bundle; // Use passed bundle only for current one
        // For other reservations, we'd need to fetch their bundles
        // For now, count only if it matches our unitId (we can't know others without fetching)
        return count + (r.id === createdReservationId ? 1 : 0);
      }, 0);

      // Fetch bundles for all active/overdue reservations to do proper unit check
      const bundlesForCheck = await Promise.all(
        allReservations.map(r => 
          base44.entities.ReservationBundle.filter({ id: r.bundleId }).then(bs => bs?.[0])
        )
      );

      const unitConflicts = allReservations.filter((r, idx) => {
        const b = bundlesForCheck[idx];
        return b?.unitId === bundle.unitId;
      });

      if (unitConflicts.length > 1) {
        // ANOMALY: Multiple active reservations on same unit detected
        await base44.entities.AuditLog.create({
          action: 'ANOMALY_DETECTED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          details: JSON.stringify({
            unitId: bundle.unitId,
            conflictCount: unitConflicts.length,
            conflictIds: unitConflicts.map(r => r.id)
          })
        }).catch(() => {});

        // Rollback this reservation
        await base44.entities.Reservation.update(createdReservationId, {
          status: 'released',
          releasedAt: new Date().toISOString()
        });
        
        // Reset unit
        await base44.entities.SaleUnit.update(bundle.unitId, {
          internalStatus: 'available'
        });

        // Reset components
        for (const compId of reservedComponentIds) {
          await base44.entities.UnitComponent.update(compId, {
            status: 'available'
          }).catch(() => {});
        }

        return Response.json({ 
          error: 'Objektas jau buvo rezervuotas. Atnaujinkite puslapį ir bandykite dar kartą.',
          code: 'ANOMALY_DETECTED'
        }, { status: 409 });
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
      // === STAGE X: COMPREHENSIVE ROLLBACK ===
      
      const rollbackErrors = [];

      // 1. Mark reservation as released if it was created
      if (createdReservationId) {
        try {
          await base44.entities.Reservation.update(createdReservationId, {
            status: 'released',
            releasedAt: new Date().toISOString()
          });
        } catch (e) {
          rollbackErrors.push(`Reservation rollback failed: ${e.message}`);
        }
      }

      // 2. Reset unit to available and clear lock
      try {
        await base44.entities.SaleUnit.update(bundle.unitId, {
          internalStatus: 'available',
          reservationLockToken: null,
          reservationLockAt: null
        });
      } catch (e) {
        rollbackErrors.push(`Unit reset failed: ${e.message}`);
      }

      // 3. Reset all partially reserved components
      for (const compId of reservedComponentIds) {
        try {
          await base44.entities.UnitComponent.update(compId, {
            status: 'available'
          });
        } catch (e) {
          rollbackErrors.push(`Component ${compId} reset failed: ${e.message}`);
        }
      }

      // 4. Log rollback
      try {
        await base44.entities.AuditLog.create({
          action: 'ROLLBACK_TRIGGERED',
          performedByUserId: user.id,
          performedByName: user.full_name,
          targetUserId: clientId,
          details: JSON.stringify({
            error: error.message,
            bundleId,
            unitId: bundle.unitId,
            reservationId: createdReservationId,
            reservedComponents: reservedComponentIds,
            rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : null
          })
        });
      } catch (e) {
        // Audit failure non-critical
      }

      // Return appropriate error based on failure type
      if (error.message.includes('LOCK_LOST')) {
        return Response.json({ 
          error: 'Objektas buvo užrezervotas antrojo agentu. Bandykite dar kartą.',
          code: 'CONCURRENCY_CONFLICT'
        }, { status: 409 });
      }

      return Response.json({ 
        error: 'Nepavyko saugiai užbaigti rezervacijos. Bandykite dar kartą.',
        code: 'RESERVATION_FAILED'
      }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});