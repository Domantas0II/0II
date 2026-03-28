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
      clientId,
      partnerId
    } = await req.json();

    // Validate required fields
    if (!fileName || !fileUrl || !assetType || !visibility || !category) {
      return Response.json({
        error: 'fileName, fileUrl, assetType, visibility, category required'
      }, { status: 400 });
    }

    // Validate owner context - at least one must be present
    const hasContext = projectId || unitId || reservationId || agreementId || paymentId || dealId || clientId || partnerId;
    if (!hasContext) {
      return Response.json({
        error: 'At least one context required'
      }, { status: 400 });
    }

    // STRICT: Validate visibility and context compatibility
    if (visibility === 'customer_safe') {
      // customer_safe MUST have customer context
      const hasCustomerContext = clientId || (reservationId || agreementId || paymentId || dealId);
      if (!hasCustomerContext) {
        return Response.json({
          error: 'customer_safe visibility requires clientId or customer-linked context (reservation, agreement, payment, deal)'
        }, { status: 400 });
      }
      // customer_safe CANNOT have partnerId
      if (partnerId) {
        return Response.json({
          error: 'customer_safe cannot have partner context'
        }, { status: 400 });
      }
    } else if (visibility === 'partner_safe') {
      // partner_safe MUST have partnerId
      if (!partnerId) {
        return Response.json({
          error: 'partner_safe visibility requires partnerId'
        }, { status: 400 });
      }
      // partner_safe CANNOT have customer context
      if (clientId || reservationId || agreementId || paymentId || dealId) {
        return Response.json({
          error: 'partner_safe cannot have customer context'
        }, { status: 400 });
      }
    } else if (visibility === 'public') {
      // public cannot inherit private scope
      if (clientId || partnerId || reservationId || agreementId || paymentId || dealId) {
        return Response.json({
          error: 'public visibility not compatible with private context'
        }, { status: 400 });
      }
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
      partnerId: partnerId || null,
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
          clientId: clientId || null,
          partnerId: partnerId || null,
          reservationId: reservationId || null,
          agreementId: agreementId || null,
          paymentId: paymentId || null,
          dealId: dealId || null
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