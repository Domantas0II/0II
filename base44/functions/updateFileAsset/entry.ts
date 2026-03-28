import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileAssetId, title, description, tagsJson, visibility, status, isPrimary, displayOrder, partnerId } = await req.json();

    if (!fileAssetId) {
      return Response.json({ error: 'fileAssetId required' }, { status: 400 });
    }

    // Fetch asset
    const assets = await base44.entities.FileAsset.filter({ id: fileAssetId });
    if (!assets || assets.length === 0) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }

    const asset = assets[0];

    // Validate status transitions
    if (status && !['draft', 'active', 'archived', 'replaced'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Cannot change status from replaced
    if (asset.status === 'replaced' && status && status !== 'replaced') {
      return Response.json({
        error: 'Cannot change status of replaced file'
      }, { status: 400 });
    }

    // Validate visibility changes
    if (visibility !== undefined && visibility !== asset.visibility) {
      // Same visibility compatibility rules as createFileAsset
      if (visibility === 'partner_safe' && !partnerId && !asset.partnerId) {
        return Response.json({
          error: 'partner_safe requires partnerId'
        }, { status: 400 });
      }
      if (visibility === 'customer_safe' && !asset.clientId) {
        return Response.json({
          error: 'customer_safe requires customer context'
        }, { status: 400 });
      }
    }

    // Update allowed fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tagsJson !== undefined) updateData.tagsJson = tagsJson;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (status !== undefined) updateData.status = status;
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (partnerId !== undefined) updateData.partnerId = partnerId;

    const updated = await base44.entities.FileAsset.update(fileAssetId, updateData);

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'FILE_UPDATED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        fileAssetId,
        changes: updateData
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