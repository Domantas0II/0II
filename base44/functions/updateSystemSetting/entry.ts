import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { key, valueJson, description, category, isPublic } = await req.json();

    if (!key || !valueJson || !category) {
      return Response.json({
        error: 'key, valueJson, category required'
      }, { status: 400 });
    }

    // Validate JSON
    try {
      JSON.parse(valueJson);
    } catch (e) {
      return Response.json({ error: 'Invalid JSON in valueJson' }, { status: 400 });
    }

    // Check if exists
    const existing = await base44.entities.SystemSetting.filter({ key });

    let setting;
    if (existing && existing.length > 0) {
      // Update
      const oldValue = existing[0].valueJson;
      setting = await base44.entities.SystemSetting.update(existing[0].id, {
        valueJson,
        description: description || existing[0].description,
        isPublic: isPublic !== undefined ? isPublic : existing[0].isPublic,
        updatedByUserId: user.id,
        updatedByName: user.full_name
      });

      // Audit
      await base44.entities.AuditLog.create({
        action: 'SYSTEM_SETTING_UPDATED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          key,
          oldValue,
          newValue: valueJson,
          category
        })
      });
    } else {
      // Create
      setting = await base44.entities.SystemSetting.create({
        key,
        valueJson,
        description: description || '',
        category,
        isPublic: isPublic || false,
        updatedByUserId: user.id,
        updatedByName: user.full_name
      });

      // Audit
      await base44.entities.AuditLog.create({
        action: 'SYSTEM_SETTING_CREATED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          key,
          value: valueJson,
          category
        })
      });
    }

    // Invalidate cache (consistent with updateSystemLimit, updateFeatureFlag)
    await base44.functions.invoke('invalidateSettingsCache', {});

    return Response.json({
      success: true,
      setting
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});