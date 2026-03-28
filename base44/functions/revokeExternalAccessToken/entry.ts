import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tokenId } = await req.json();

    if (!tokenId) {
      return Response.json({ error: 'tokenId required' }, { status: 400 });
    }

    // Fetch and revoke
    const tokens = await base44.entities.ExternalAccessToken.filter({ id: tokenId });
    if (!tokens || tokens.length === 0) {
      return Response.json({ error: 'Token not found' }, { status: 404 });
    }

    const tokenRecord = tokens[0];
    await base44.entities.ExternalAccessToken.update(tokenId, {
      status: 'revoked'
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'EXTERNAL_TOKEN_REVOKED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        tokenId,
        accessType: tokenRecord.accessType
      })
    });

    return Response.json({
      success: true,
      message: 'Token revoked'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});