import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token required' }, { status: 400 });
    }

    // Validate token
    const tokens = await base44.asServiceRole.entities.ExternalAccessToken.filter({
      token
    });

    if (!tokens || tokens.length === 0 || tokens[0].status !== 'active') {
      return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const tokenRecord = tokens[0];

    // Only customer portal tokens allowed
    if (tokenRecord.accessType !== 'customer_portal') {
      return Response.json({ error: 'Invalid access type' }, { status: 403 });
    }

    if (!tokenRecord.clientId) {
      return Response.json({ error: 'Token missing client scope' }, { status: 401 });
    }

    // Fetch client (minimal safe fields)
    const clients = await base44.asServiceRole.entities.Client.filter({
      id: tokenRecord.clientId
    });

    if (!clients || clients.length === 0) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = clients[0];

    // Fetch reservations for this client
    const reservations = await base44.asServiceRole.entities.Reservation.filter({
      clientId: tokenRecord.clientId
    });

    // Safe reservation projection
    const safeReservations = (reservations || []).map(r => ({
      id: r.id,
      status: r.status,
      reservedAt: r.reservedAt,
      expiresAt: r.expiresAt,
      releasedAt: r.releasedAt,
      convertedAt: r.convertedAt,
      projectId: r.projectId,
      bundleId: r.bundleId
    }));

    // Fetch agreements
    const agreements = await base44.asServiceRole.entities.Agreement.filter({
      clientId: tokenRecord.clientId
    });

    const safeAgreements = (agreements || []).map(a => ({
      id: a.id,
      agreementType: a.agreementType,
      status: a.status,
      signedAt: a.signedAt,
      reservationId: a.reservationId
    }));

    // Fetch payments
    const payments = await base44.asServiceRole.entities.Payment.filter({
      clientId: tokenRecord.clientId
    });

    const safePayments = (payments || []).map(p => ({
      id: p.id,
      amount: p.amount,
      amountWithVat: p.amountWithVat,
      paidAt: p.paidAt,
      status: p.status,
      paymentType: p.paymentType
    }));

    // Fetch units for reservations (via bundle -> unit mapping)
    const safeUnits = [];
    for (const res of safeReservations) {
      if (res.bundleId) {
        // Fetch bundle to get unitId
        const bundles = await base44.asServiceRole.entities.ReservationBundle.filter({
          id: res.bundleId
        });
        if (bundles && bundles.length > 0) {
          const unitId = bundles[0].unitId;
          const units = await base44.asServiceRole.entities.SaleUnit.filter({
            id: unitId
          });
          if (units && units.length > 0) {
            const u = units[0];
            safeUnits.push({
              id: u.id,
              label: u.label,
              type: u.type,
              areaM2: u.areaM2,
              price: u.price,
              publicPrice: u.publicPrice,
              roomsCount: u.roomsCount,
              bathroomsCount: u.bathroomsCount,
              publicDescription: u.publicDescription,
              publicImages: u.publicImages
            });
          }
        }
      }
    }

    // Log portal access
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'CUSTOMER_PORTAL_ACCESSED',
      targetUserId: null,
      details: JSON.stringify({
        tokenId: tokenRecord.id,
        clientId: tokenRecord.clientId
      })
    });

    return Response.json({
      success: true,
      client: {
        id: client.id,
        fullName: client.fullName,
        email: client.email,
        phone: client.phone
      },
      reservations: safeReservations,
      agreements: safeAgreements,
      payments: safePayments,
      units: safeUnits,
      message: 'Safe customer portal data - internal CRM fields excluded'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});