import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { agreementId } = body;

    if (!agreementId) {
      return Response.json({ error: 'agreementId reikalingas' }, { status: 400 });
    }

    // === VALIDACIJA ===
    
    const agreement = await base44.entities.Agreement.filter({ id: agreementId }).then(r => r?.[0]);
    if (!agreement) {
      return Response.json({ error: 'Sutartis nerasta' }, { status: 400 });
    }

    // Status turi būti draft
    if (agreement.status !== 'draft') {
      return Response.json({ error: 'Tik juodraščiai gali būti pasirašyti' }, { status: 400 });
    }

    // Reservation vis dar validi
    const reservation = await base44.entities.Reservation.filter({ id: agreement.reservationId }).then(r => r?.[0]);
    if (!reservation) {
      return Response.json({ error: 'Susijusi rezervacija nebeegzistuoja' }, { status: 400 });
    }

    // Negali pasirašyti released reservation sutarties
    if (reservation.status === 'released') {
      return Response.json({ error: 'Atleistos rezervacijos sutarties negalima pasirašyti' }, { status: 400 });
    }

    // Negali pasirašyti jei jau yra Deal šiai rezervacijai
    const existingDeal = await base44.entities.Deal.filter({ reservationId: agreement.reservationId }).then(r => r?.[0]);
    if (existingDeal) {
      return Response.json({ error: 'Šiai rezervacijai jau egzistuoja pardavimas' }, { status: 409 });
    }

    // === PASIRAŠYTI AGREEMENT ===

    const signedAt = new Date().toISOString();

    // SOURCE-OF-TRUTH: užtikrinti, kad soldByUserId būtų užpildytas pasirašant.
    const updatePayload = { status: 'signed', signedAt };
    if (!agreement.soldByUserId) {
      updatePayload.soldByUserId = reservation.reservedByUserId || user.id;
    }

    await base44.entities.Agreement.update(agreementId, updatePayload);

    // === AUDIT LOG: AGREEMENT_SIGNED ===
    await base44.entities.AuditLog.create({
      action: 'AGREEMENT_SIGNED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      targetUserId: agreement.clientId,
      details: JSON.stringify({
        agreementId,
        reservationId: agreement.reservationId,
        signedAt
      })
    }).catch(() => {});

    // === AUTO-CREATE DEAL (FLOW LOCK) ===
    // Pasirašyta sutartis automatiškai sukuria Deal — rankinis kūrimas neleidžiamas
    
    const bundle = await base44.entities.ReservationBundle.filter({ id: reservation.bundleId }).then(r => r?.[0]);
    if (!bundle) {
      // Agreement pasirašyta, bet Deal negalima sukurti — loguojame kaip integrity issue
      await base44.asServiceRole.entities.DataIntegrityIssue.create({
        issueType: 'AGREEMENT_SIGNED_NO_BUNDLE',
        entityType: 'Agreement',
        entityId: agreementId,
        description: `Agreement ${agreementId} pasirašyta, bet bundle ${reservation.bundleId} nerastas — Deal nesukurtas`,
        severity: 'high',
        detectedAt: new Date().toISOString(),
        resolved: false
      }).catch(() => {});

      return Response.json({ 
        success: true, 
        warning: 'Sutartis pasirašyta, tačiau automatinis pardavimas nepavyko — bundle nerastas. Kreipkitės į administratorių.'
      });
    }

    // Invoke createDeal as service role (bypass role check since this is system-triggered)
    let dealId = null;
    try {
      const dealResult = await base44.asServiceRole.functions.invoke('createDeal', {
        projectId: agreement.projectId,
        unitId: bundle.unitId,
        clientId: agreement.clientId,
        reservationId: agreement.reservationId,
        agreementId,
        soldAt: signedAt,
        isDeveloperSale: false
      });

      if (dealResult?.data?.dealId) {
        dealId = dealResult.data.dealId;
      } else if (dealResult?.data?.error) {
        // createDeal grąžino klaidą — loguojame
        await base44.asServiceRole.entities.DataIntegrityIssue.create({
          issueType: 'AUTO_DEAL_CREATION_FAILED',
          entityType: 'Agreement',
          entityId: agreementId,
          description: `Auto Deal creation failed after signing agreement ${agreementId}: ${dealResult.data.error}`,
          severity: 'high',
          detectedAt: new Date().toISOString(),
          resolved: false
        }).catch(() => {});
      }
    } catch (dealError) {
      console.warn('Auto Deal creation failed (non-blocking):', dealError?.message);
      await base44.asServiceRole.entities.DataIntegrityIssue.create({
        issueType: 'AUTO_DEAL_CREATION_FAILED',
        entityType: 'Agreement',
        entityId: agreementId,
        description: `Auto Deal creation exception after signing agreement ${agreementId}: ${dealError?.message}`,
        severity: 'high',
        detectedAt: new Date().toISOString(),
        resolved: false
      }).catch(() => {});
    }

    return Response.json({ 
      success: true, 
      dealId,
      autoCreateDeal: !!dealId
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});