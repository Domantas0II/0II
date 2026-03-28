import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token required' }, { status: 400 });
    }

    // Find token
    const tokens = await base44.asServiceRole.entities.ExternalAccessToken.filter({
      token
    });

    if (!tokens || tokens.length === 0) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const tokenRecord = tokens[0];

    // Check status
    if (tokenRecord.status !== 'active') {
      return Response.json({
        error: `Token is ${tokenRecord.status}`
      }, { status: 401 });
    }

    // Check expiry
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      // Mark as expired
      await base44.asServiceRole.entities.ExternalAccessToken.update(tokenRecord.id, {
        status: 'expired'
      });
      return Response.json({ error: 'Token expired' }, { status: 401 });
    }

    // Update lastUsedAt
    await base44.asServiceRole.entities.ExternalAccessToken.update(tokenRecord.id, {
      lastUsedAt: new Date().toISOString()
    });

    return Response.json({
      success: true,
      scope: {
        accessType: tokenRecord.accessType,
        clientId: tokenRecord.clientId,
        partnerId: tokenRecord.partnerId,
        projectId: tokenRecord.projectId,
        reservationId: tokenRecord.reservationId,
        agreementId: tokenRecord.agreementId
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});