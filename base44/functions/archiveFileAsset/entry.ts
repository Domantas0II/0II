import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileAssetId } = await req.json();

    if (!fileAssetId) {
      return Response.json({ error: 'fileAssetId required' }, { status: 400 });
    }

    // Fetch asset
    const assets = await base44.entities.FileAsset.filter({ id: fileAssetId });
    if (!assets || assets.length === 0) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }

    const asset = assets[0];

    if (asset.status === 'replaced') {
      return Response.json({
        error: 'Cannot archive replaced file'
      }, { status: 400 });
    }

    // Archive
    const updated = await base44.entities.FileAsset.update(fileAssetId, {
      status: 'archived'
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'FILE_ARCHIVED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        fileAssetId,
        fileName: asset.fileName
      })
    });

    return Response.json({
      success: true,
      fileAsset: updated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});