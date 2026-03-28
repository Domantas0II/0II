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

    // === PASIRAŠYTI AGREEMENT ===
    
    const signedAt = new Date().toISOString();
    await base44.entities.Agreement.update(agreementId, {
      status: 'signed',
      signedAt
    });

    // === AUDIT LOG ===
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

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});