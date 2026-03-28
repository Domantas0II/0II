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

    // Negalima atšaukti jei Deal jau sukurtas
    const deal = await base44.entities.Deal.filter({ agreementId }).then(r => r?.[0]);
    if (deal) {
      return Response.json({ error: 'Negalima atšaukti sutarties, jei pardavimas jau sukurtas' }, { status: 400 });
    }

    // === ATŠAUKTI AGREEMENT ===
    
    await base44.entities.Agreement.update(agreementId, {
      status: 'cancelled'
    });

    // === AUDIT LOG ===
    await base44.entities.AuditLog.create({
      action: 'AGREEMENT_CANCELLED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      targetUserId: agreement.clientId,
      details: JSON.stringify({
        agreementId,
        reservationId: agreement.reservationId
      })
    }).catch(() => {});

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});