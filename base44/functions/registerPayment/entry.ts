import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, clientId, reservationId, agreementId, paymentType, amount, vatRate, paidAt, notes } = body;

    // === VALIDACIJA ===
    
    if (!projectId || !clientId || !paymentType || !amount || !paidAt) {
      return Response.json({ error: 'Privalomi laukai trūksta' }, { status: 400 });
    }

    // amount > 0
    if (amount <= 0) {
      return Response.json({ error: 'Suma turi būti didesnė nei 0' }, { status: 400 });
    }

    // Bent vienas iš reservationId / agreementId
    if (!reservationId && !agreementId) {
      return Response.json({ error: 'Bent vienas iš: reservationId arba agreementId turi būti nurodyta' }, { status: 400 });
    }

    // Jei reservationId
    if (reservationId) {
      const reservation = await base44.entities.Reservation.filter({ id: reservationId }).then(r => r?.[0]);
      if (!reservation) {
        return Response.json({ error: 'Rezervacija nerasta' }, { status: 400 });
      }
      if (reservation.projectId !== projectId) {
        return Response.json({ error: 'Rezervacija nepriklauso šiam projektui' }, { status: 400 });
      }
      if (reservation.clientId !== clientId) {
        return Response.json({ error: 'Rezervacija nepriklauso šiam klientui' }, { status: 400 });
      }
    }

    // Jei agreementId
    if (agreementId) {
      const agreement = await base44.entities.Agreement.filter({ id: agreementId }).then(r => r?.[0]);
      if (!agreement) {
        return Response.json({ error: 'Sutartis nerasta' }, { status: 400 });
      }
      if (agreement.projectId !== projectId) {
        return Response.json({ error: 'Sutartis nepriklauso šiam projektui' }, { status: 400 });
      }
      if (agreement.clientId !== clientId) {
        return Response.json({ error: 'Sutartis nepriklauso šiam klientui' }, { status: 400 });
      }
    }

    // === SKAIČIAVIMAS ===
    
    let amountWithVat = amount;
    let amountWithoutVat = amount;
    
    if (vatRate && vatRate > 0) {
      // Jei vatRate yra, turi būti paskaičiuoti iš amounts
      amountWithoutVat = amount / (1 + vatRate / 100);
      amountWithVat = amount;
    }

    // === SUKURTI PAYMENT ===
    
    const payment = await base44.entities.Payment.create({
      projectId,
      clientId,
      reservationId: reservationId || null,
      agreementId: agreementId || null,
      paymentType,
      amount,
      vatRate: vatRate || 0,
      amountWithVat,
      amountWithoutVat,
      paidAt,
      status: 'recorded',
      notes,
      createdByUserId: user.id
    });

    // === AUDIT LOG ===
    await base44.entities.AuditLog.create({
      action: 'PAYMENT_RECORDED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      targetUserId: clientId,
      details: JSON.stringify({
        paymentId: payment.id,
        reservationId,
        agreementId,
        amount,
        paymentType
      })
    }).catch(() => {});

    return Response.json({ success: true, paymentId: payment.id });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});