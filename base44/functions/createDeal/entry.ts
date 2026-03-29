import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // === ROLE CHECK ===
    const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);
    const userRole = normalizeRole(user.role);
    if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(userRole)) {
      return Response.json({ error: 'Tik administratoriai ir vadybininkai gali kurti pardavimus' }, { status: 403 });
    }

    const body = await req.json();
    const { projectId, unitId, clientId, reservationId, agreementId, soldAt, isDeveloperSale } = body;

    // === VALIDACIJA ===
    
    if (!projectId || !unitId || !clientId || !reservationId || !agreementId || !soldAt) {
      return Response.json({ error: 'Privalomi laukai trūksta' }, { status: 400 });
    }

    // Reservation egzistuoja
    const reservation = await base44.entities.Reservation.filter({ id: reservationId }).then(r => r?.[0]);
    if (!reservation) {
      return Response.json({ error: 'Rezervacija nerasta' }, { status: 400 });
    }

    // Agreement egzistuoja
    const agreement = await base44.entities.Agreement.filter({ id: agreementId }).then(r => r?.[0]);
    if (!agreement) {
      return Response.json({ error: 'Sutartis nerasta' }, { status: 400 });
    }

    // Unit egzistuoja
    const unit = await base44.entities.SaleUnit.filter({ id: unitId }).then(r => r?.[0]);
    if (!unit) {
      return Response.json({ error: 'Objektas nerastas' }, { status: 400 });
    }

    // === KELIAS VALIDACIJA ===
    
    if (reservation.projectId !== projectId) {
      return Response.json({ error: 'Rezervacija nepriklauso šiam projektui' }, { status: 400 });
    }
    if (agreement.projectId !== projectId) {
      return Response.json({ error: 'Sutartis nepriklauso šiam projektui' }, { status: 400 });
    }
    if (unit.projectId !== projectId) {
      return Response.json({ error: 'Objektas nepriklauso šiam projektui' }, { status: 400 });
    }
    if (reservation.clientId !== clientId) {
      return Response.json({ error: 'Rezervacija nepriklauso šiam klientui' }, { status: 400 });
    }
    if (agreement.clientId !== clientId) {
      return Response.json({ error: 'Sutartis nepriklauso šiam klientui' }, { status: 400 });
    }

    // === BŪSENOS VALIDACIJA ===
    
    // Agreement turi būti signed
    if (agreement.status !== 'signed') {
      return Response.json({ error: 'Sutartis turi būti pasirašyta' }, { status: 400 });
    }

    // Reservation turi būti active arba overdue (bet jei converted, yra issue)
    if (!['active', 'overdue'].includes(reservation.status)) {
      return Response.json({ error: 'Rezervacija turi būti aktyvi arba pasibaigus laikui' }, { status: 400 });
    }

    // Unit negali būti sold
    if (unit.internalStatus === 'sold') {
      return Response.json({ error: 'Objektas jau parduotas' }, { status: 400 });
    }

    // Tam pačiam unit negali egzistuoti kitas Deal
    const existingDeal = await base44.entities.Deal.filter({ unitId }).then(r => r?.[0]);
    if (existingDeal) {
      return Response.json({ error: 'Tam pačiam objektui jau yra pardavimas' }, { status: 400 });
    }

    // === BUNDLE + AMOUNT ===

    const bundle = await base44.entities.ReservationBundle.filter({ id: reservation.bundleId }).then(r => r?.[0]);
    if (!bundle) {
      return Response.json({ error: 'Rezervacijos pluštas neegzistuoja' }, { status: 400 });
    }

    // Bundle.unitId turi sutapti su šiuo unitId
    if (bundle.unitId !== unitId) {
      return Response.json({ error: 'Bundle objektas nesutampa su paduotu objektu' }, { status: 400 });
    }

    const totalAmount = bundle.finalTotalPrice;

    // === SUKURTI DEAL ===
    
    let createdDealId = null;
    const updatedComponentIds = [];

    try {
      // Create deal
      const deal = await base44.entities.Deal.create({
        projectId,
        unitId,
        clientId,
        reservationId,
        agreementId,
        soldAt,
        soldByUserId: user.id,
        totalAmount,
        commissionPercent: 0,
        commissionVatMode: 'without_vat',
        commissionAmountWithVat: 0,
        commissionAmountWithoutVat: 0,
        isDeveloperSale: isDeveloperSale || false
      });
      createdDealId = deal.id;

      // === ATOMIC STATUS SYNC ===
      
      // 1. Reservation → converted
      await base44.entities.Reservation.update(reservationId, {
        status: 'converted',
        convertedAt: new Date().toISOString()
      });

      // 2. SaleUnit → sold
      await base44.entities.SaleUnit.update(unitId, {
        internalStatus: 'sold'
      });

      // 3. Bundle components → sold
      if (bundle.componentIds && bundle.componentIds.length > 0) {
        for (const compId of bundle.componentIds) {
          await base44.entities.UnitComponent.update(compId, {
            status: 'sold'
          });
          updatedComponentIds.push(compId);
        }
      }

      // 4. ClientProjectInterest → won
      const interest = await base44.entities.ClientProjectInterest.filter({ id: reservation.clientProjectInterestId }).then(r => r?.[0]);
      if (interest) {
        await base44.entities.ClientProjectInterest.update(interest.id, {
          status: 'completed',
          pipelineStage: 'won'
        });
      }

      // === AUDIT LOGS ===
      
      const auditActions = [
        { action: 'DEAL_CREATED', details: { dealId: deal.id, unitId, totalAmount } },
        { action: 'RESERVATION_CONVERTED', details: { reservationId } },
        { action: 'UNIT_SOLD', details: { unitId } }
      ];

      if (updatedComponentIds.length > 0) {
        auditActions.push({ action: 'BUNDLE_COMPONENTS_SOLD', details: { componentIds: updatedComponentIds } });
      }

      for (const auditAction of auditActions) {
        await base44.entities.AuditLog.create({
          action: auditAction.action,
          performedByUserId: user.id,
          performedByName: user.full_name,
          targetUserId: clientId,
          details: JSON.stringify(auditAction.details)
        }).catch(() => {});
      }

      // === MODULE 17: AUTO-GENERATE COMMISSION ===
      base44.functions.invoke('calculateCommission', { dealId: deal.id }).catch((e) => {
        console.warn('Commission auto-generation failed (non-blocking):', e?.message);
      });

      // === MODULE 19: EVENT BUS ===
      base44.asServiceRole.functions.invoke('dispatchEvent', {
        eventType: 'DEAL_CREATED',
        entityType: 'Deal',
        entityId: deal.id,
        payload: { dealId: deal.id, projectId, unitId, soldAt, totalAmount }
      }).catch(() => {});

      return Response.json({ success: true, dealId: deal.id });

    } catch (error) {
      // === ROLLBACK ===
      
      if (createdDealId) {
        try {
          await base44.entities.Deal.delete(createdDealId);
        } catch (e) {}
      }

      const rollbackErrors = [];

      // Reset reservation
      try {
        await base44.entities.Reservation.update(reservationId, {
          status: 'active'
        });
      } catch (e) {
        rollbackErrors.push(`Reservation reset failed: ${e.message}`);
      }

      // Reset unit to reserved (not available - it was reserved before deal attempt)
      try {
        await base44.entities.SaleUnit.update(unitId, {
          internalStatus: 'reserved'
        });
      } catch (e) {
        rollbackErrors.push(`Unit reset failed: ${e.message}`);
      }

      // Reset components to reserved (restore to pre-deal state)
      for (const compId of updatedComponentIds) {
        try {
          await base44.entities.UnitComponent.update(compId, {
            status: 'reserved'
          });
        } catch (e) {
          rollbackErrors.push(`Component reset failed: ${e.message}`);
        }
      }

      // Log rollback with state restoration details
      await base44.entities.AuditLog.create({
        action: 'DEAL_ROLLBACK',
        performedByUserId: user.id,
        performedByName: user.full_name,
        targetUserId: clientId,
        details: JSON.stringify({
          error: error.message,
          reservationId,
          unitId,
          restoredToReserved: true,
          restoredComponentCount: updatedComponentIds.length,
          rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : null
        })
      }).catch(() => {});

      return Response.json({ 
        error: 'Pardavimo finalizacija nepavyko. Bandykite dar kartą.',
        code: 'DEAL_CREATION_FAILED'
      }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});