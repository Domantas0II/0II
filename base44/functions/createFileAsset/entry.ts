import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      fileName,
      originalFileName,
      mimeType,
      fileSizeBytes,
      fileUrl,
      thumbnailUrl,
      assetType,
      visibility,
      category,
      title,
      description,
      tagsJson,
      isPrimary,
      displayOrder,
      projectId,
      unitId,
      reservationId,
      agreementId,
      paymentId,
      dealId,
      clientId
    } = await req.json();

    // Validate required fields
    if (!fileName || !fileUrl || !assetType || !visibility || !category) {
      return Response.json({
        error: 'fileName, fileUrl, assetType, visibility, category required'
      }, { status: 400 });
    }

    // Validate owner context - at least one must be present
    const hasContext = projectId || unitId || reservationId || agreementId || paymentId || dealId || clientId;
    if (!hasContext) {
      return Response.json({
        error: 'At least one context required: projectId, unitId, reservationId, agreementId, paymentId, dealId, clientId'
      }, { status: 400 });
    }

    // Validate visibility compatibility
    if (visibility !== 'internal' && visibility !== 'public') {
      // external_safe types require explicit token scope in FileAccessGrant
      // Allow creation, but will be controlled by grants
    }

    // Validate visibility matches context
    if (visibility === 'public' && (reservationId || agreementId || paymentId || dealId || clientId)) {
      return Response.json({
        error: 'Public visibility not compatible with private context (reservation, agreement, payment, deal, client)'
      }, { status: 400 });
    }

    // Create FileAsset
    const asset = await base44.entities.FileAsset.create({
      fileName,
      originalFileName: originalFileName || fileName,
      mimeType: mimeType || 'application/octet-stream',
      fileSizeBytes: fileSizeBytes || 0,
      fileUrl,
      thumbnailUrl: thumbnailUrl || null,
      assetType,
      visibility,
      status: 'draft',
      versionNumber: 1,
      category,
      title: title || fileName,
      description: description || null,
      tagsJson: tagsJson || '[]',
      isPrimary: isPrimary || false,
      displayOrder: displayOrder || 0,
      projectId: projectId || null,
      unitId: unitId || null,
      reservationId: reservationId || null,
      agreementId: agreementId || null,
      paymentId: paymentId || null,
      dealId: dealId || null,
      clientId: clientId || null,
      uploadedByUserId: user.id,
      uploadedByName: user.full_name
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'FILE_UPLOADED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      targetUserId: null,
      details: JSON.stringify({
        fileAssetId: asset.id,
        fileName,
        category,
        visibility,
        context: {
          projectId: projectId || null,
          unitId: unitId || null,
          reservationId: reservationId || null,
          agreementId: agreementId || null,
          paymentId: paymentId || null,
          dealId: dealId || null,
          clientId: clientId || null
        }
      })
    });

    return Response.json({
      success: true,
      fileAsset: asset
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});