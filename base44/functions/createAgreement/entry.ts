import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, reservationId, clientId, agreementType, notes } = body;

    // === VALIDACIJA ===
    
    if (!projectId || !reservationId || !clientId || !agreementType) {
      return Response.json({ error: 'Privalomi laukai trūksta' }, { status: 400 });
    }

    // Reservation egzistuoja
    const reservation = await base44.entities.Reservation.filter({ id: reservationId }).then(r => r?.[0]);
    if (!reservation) {
      return Response.json({ error: 'Rezervacija nerasta' }, { status: 400 });
    }

    // Kelias: reservation.projectId === projectId
    if (reservation.projectId !== projectId) {
      return Response.json({ error: 'Rezervacija nepriklauso šiam projektui' }, { status: 400 });
    }

    // Kelias: reservation.clientId === clientId
    if (reservation.clientId !== clientId) {
      return Response.json({ error: 'Rezervacija nepriklauso šiam klientui' }, { status: 400 });
    }

    // Status negali būti released
    if (reservation.status === 'released') {
      return Response.json({ error: 'Atleista rezervacija negali turėti sutarties' }, { status: 400 });
    }

    // Status turi būti active arba overdue (converted reikalingos žinios)
    if (!['active', 'overdue', 'converted'].includes(reservation.status)) {
      return Response.json({ error: 'Šios būsenos rezervacija negali turėti sutarties' }, { status: 400 });
    }

    // ClientProjectInterest egzistuoja
    const interest = await base44.entities.ClientProjectInterest.filter({
      id: reservation.clientProjectInterestId
    }).then(r => r?.[0]);
    
    if (!interest || interest.projectId !== projectId || interest.clientId !== clientId) {
      return Response.json({ error: 'Kliento susidomėjimas nepriklauso šiam keliui' }, { status: 400 });
    }

    // === SUKURTI AGREEMENT ===
    
    const agreement = await base44.entities.Agreement.create({
      projectId,
      reservationId,
      clientId,
      agreementType,
      status: 'draft',
      notes,
      createdByUserId: user.id
    });

    // === AUDIT LOG ===
    await base44.entities.AuditLog.create({
      action: 'AGREEMENT_CREATED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      targetUserId: clientId,
      details: JSON.stringify({
        agreementId: agreement.id,
        reservationId,
        agreementType
      })
    }).catch(() => {});

    return Response.json({ success: true, agreementId: agreement.id });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});