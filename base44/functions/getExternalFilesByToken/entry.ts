import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token required' }, { status: 400 });
    }

    // Validate external access token
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
      await base44.asServiceRole.entities.ExternalAccessToken.update(tokenRecord.id, {
        status: 'expired'
      });
      return Response.json({ error: 'Token expired' }, { status: 401 });
    }

    // STRICT: Isolate customer vs partner scope
    const filter = {
      status: { $in: ['active'] }
    };

    if (tokenRecord.accessType === 'customer_portal') {
      // CUSTOMER: tik customer_safe, tik customer scope
      filter.visibility = { $in: ['customer_safe'] };
      
      // Apply customer context scope
      if (tokenRecord.clientId) {
        filter.clientId = tokenRecord.clientId;
      }
      if (tokenRecord.reservationId) {
        filter.reservationId = tokenRecord.reservationId;
      }
      if (tokenRecord.agreementId) {
        filter.agreementId = tokenRecord.agreementId;
      }
      if (tokenRecord.projectId) {
        filter.projectId = tokenRecord.projectId;
      }
      
      // CRITICAL: NIEKADA jokio partnerId filtro
      // customer negali gauti partner failus
      
    } else if (tokenRecord.accessType === 'partner_portal') {
      // PARTNER: tik partner_safe, tik partner scope
      filter.visibility = { $in: ['partner_safe'] };
      filter.partnerId = tokenRecord.partnerId;
      
      // CRITICAL: NIEKADA jokio clientId/reservation/agreement/payment/deal filtro
      // partner negali gauti customer failus
      
    } else {
      return Response.json({ error: 'Invalid access type' }, { status: 403 });
    }

    // Fetch safe files
    const files = await base44.asServiceRole.entities.FileAsset.filter(
      filter,
      '-created_date',
      50
    );

    // Update token lastUsedAt
    await base44.asServiceRole.entities.ExternalAccessToken.update(tokenRecord.id, {
      lastUsedAt: new Date().toISOString()
    });

    // Log audit
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'EXTERNAL_FILES_ACCESSED',
      targetUserId: null,
      details: JSON.stringify({
        tokenId: tokenRecord.id,
        accessType: tokenRecord.accessType,
        fileCount: files?.length || 0
      })
    });

    return Response.json({
      success: true,
      files: files || [],
      count: files?.length || 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});