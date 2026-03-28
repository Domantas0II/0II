import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { grantId } = await req.json();

    if (!grantId) {
      return Response.json({ error: 'grantId required' }, { status: 400 });
    }

    // Fetch grant
    const grants = await base44.entities.FileAccessGrant.filter({ id: grantId });
    if (!grants || grants.length === 0) {
      return Response.json({ error: 'Grant not found' }, { status: 404 });
    }

    const grant = grants[0];

    // Revoke
    const updated = await base44.entities.FileAccessGrant.update(grantId, {
      status: 'revoked',
      revokedAt: new Date().toISOString()
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'FILE_ACCESS_REVOKED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        grantId,
        fileAssetId: grant.fileAssetId,
        accessType: grant.accessType
      })
    });

    return Response.json({
      success: true,
      grant: updated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});