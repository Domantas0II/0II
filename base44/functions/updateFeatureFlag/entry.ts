import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { key, isEnabled, rolloutType, allowedRoles, percentage, description } = await req.json();

    if (!key || rolloutType === undefined) {
      return Response.json({
        error: 'key, rolloutType required'
      }, { status: 400 });
    }

    if (!['all', 'role_based', 'percentage'].includes(rolloutType)) {
      return Response.json({ error: 'Invalid rolloutType' }, { status: 400 });
    }

    if (rolloutType === 'percentage' && (percentage < 0 || percentage > 100)) {
      return Response.json({ error: 'Percentage must be 0-100' }, { status: 400 });
    }

    // Check if exists
    const existing = await base44.entities.FeatureFlag.filter({ key });

    let flag;
    if (existing && existing.length > 0) {
      // Update
      const oldState = { isEnabled: existing[0].isEnabled, rolloutType: existing[0].rolloutType };
      flag = await base44.entities.FeatureFlag.update(existing[0].id, {
        isEnabled: isEnabled !== undefined ? isEnabled : existing[0].isEnabled,
        rolloutType,
        allowedRoles: allowedRoles || existing[0].allowedRoles,
        percentage: percentage !== undefined ? percentage : existing[0].percentage,
        description: description || existing[0].description,
        updatedByUserId: user.id,
        updatedByName: user.full_name
      });

      // Audit
      await base44.entities.AuditLog.create({
        action: 'FEATURE_FLAG_UPDATED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          key,
          oldState,
          newState: { isEnabled: flag.isEnabled, rolloutType: flag.rolloutType }
        })
      });
    } else {
      // Create
      flag = await base44.entities.FeatureFlag.create({
        key,
        isEnabled: isEnabled || false,
        rolloutType,
        allowedRoles: allowedRoles || [],
        percentage: percentage || 0,
        description: description || '',
        updatedByUserId: user.id,
        updatedByName: user.full_name
      });

      // Audit
      await base44.entities.AuditLog.create({
        action: 'FEATURE_FLAG_CREATED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          key,
          rolloutType,
          isEnabled
        })
      });
    }

    return Response.json({
      success: true,
      flag
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});