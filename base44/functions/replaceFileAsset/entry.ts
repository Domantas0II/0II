import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      oldFileAssetId,
      newFileName,
      newFileUrl,
      newThumbnailUrl,
      newMimeType,
      newFileSizeBytes,
      title,
      description
    } = await req.json();

    if (!oldFileAssetId || !newFileName || !newFileUrl) {
      return Response.json({
        error: 'oldFileAssetId, newFileName, newFileUrl required'
      }, { status: 400 });
    }

    // Fetch old asset
    const oldAssets = await base44.entities.FileAsset.filter({ id: oldFileAssetId });
    if (!oldAssets || oldAssets.length === 0) {
      return Response.json({ error: 'Old file not found' }, { status: 404 });
    }

    const oldAsset = oldAssets[0];

    // Mark old as replaced
    await base44.entities.FileAsset.update(oldFileAssetId, {
      status: 'replaced'
    });

    // Create new version (inherit all context from old)
    const newAsset = await base44.entities.FileAsset.create({
      fileName: newFileName,
      originalFileName: newFileName,
      mimeType: newMimeType || oldAsset.mimeType,
      fileSizeBytes: newFileSizeBytes || 0,
      fileUrl: newFileUrl,
      thumbnailUrl: newThumbnailUrl || null,
      assetType: oldAsset.assetType,
      visibility: oldAsset.visibility,
      status: 'active',
      versionNumber: (oldAsset.versionNumber || 1) + 1,
      replacesFileAssetId: oldFileAssetId,
      category: oldAsset.category,
      title: title || newFileName,
      description: description || oldAsset.description,
      tagsJson: oldAsset.tagsJson,
      isPrimary: oldAsset.isPrimary,
      displayOrder: oldAsset.displayOrder,
      projectId: oldAsset.projectId || null,
      unitId: oldAsset.unitId || null,
      clientId: oldAsset.clientId || null,
      partnerId: oldAsset.partnerId || null,
      reservationId: oldAsset.reservationId || null,
      agreementId: oldAsset.agreementId || null,
      paymentId: oldAsset.paymentId || null,
      dealId: oldAsset.dealId || null,
      uploadedByUserId: user.id,
      uploadedByName: user.full_name
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'FILE_REPLACED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        oldFileAssetId,
        newFileAssetId: newAsset.id,
        newVersion: newAsset.versionNumber
      })
    });

    return Response.json({
      success: true,
      oldAsset: { id: oldFileAssetId, status: 'replaced' },
      newAsset,
      message: `File replaced. New version: ${newAsset.versionNumber}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});