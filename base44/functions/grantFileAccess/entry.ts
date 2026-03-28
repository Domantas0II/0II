import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const {
      fileAssetId,
      accessType,
      externalAccessTokenId,
      userId,
      expiresAt
    } = await req.json();

    if (!fileAssetId || !accessType) {
      return Response.json({
        error: 'fileAssetId, accessType required'
      }, { status: 400 });
    }

    if (!['customer_token', 'partner_token', 'internal_user'].includes(accessType)) {
      return Response.json({ error: 'Invalid accessType' }, { status: 400 });
    }

    // Validate token/user depending on type
    if (accessType === 'customer_token' || accessType === 'partner_token') {
      if (!externalAccessTokenId) {
        return Response.json({
          error: 'externalAccessTokenId required for token access'
        }, { status: 400 });
      }
    } else if (accessType === 'internal_user') {
      if (!userId) {
        return Response.json({
          error: 'userId required for internal user access'
        }, { status: 400 });
      }
    }

    // Create grant
    const grant = await base44.entities.FileAccessGrant.create({
      fileAssetId,
      accessType,
      externalAccessTokenId: externalAccessTokenId || null,
      userId: userId || null,
      status: 'active',
      expiresAt: expiresAt || null,
      grantedByUserId: user.id
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'FILE_ACCESS_GRANTED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        fileAssetId,
        grantId: grant.id,
        accessType,
        expiresAt: expiresAt || 'never'
      })
    });

    return Response.json({
      success: true,
      grant
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});