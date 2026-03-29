import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || normalizeRole(user.role) !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { key, value, unit, description, category } = await req.json();

    if (!key || value === undefined) {
      return Response.json({
        error: 'key, value required'
      }, { status: 400 });
    }

    if (value < 0) {
      return Response.json({ error: 'value must be >= 0' }, { status: 400 });
    }

    // Check if exists
    const existing = await base44.entities.SystemLimit.filter({ key });

    let limit;
    if (existing && existing.length > 0) {
      // Update
      const oldValue = existing[0].value;
      limit = await base44.entities.SystemLimit.update(existing[0].id, {
        value,
        unit: unit || existing[0].unit,
        description: description || existing[0].description,
        updatedByUserId: user.id
      });

      // Audit
      await base44.entities.AuditLog.create({
        action: 'SYSTEM_LIMIT_UPDATED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          key,
          oldValue,
          newValue: value,
          unit: unit || existing[0].unit
        })
      });
    } else {
      // Create
      limit = await base44.entities.SystemLimit.create({
        key,
        value,
        unit: unit || 'count',
        description: description || '',
        category: category || 'other',
        updatedByUserId: user.id
      });

      // Audit
      await base44.entities.AuditLog.create({
        action: 'SYSTEM_LIMIT_CREATED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          key,
          value,
          unit: unit || 'count'
        })
      });
    }

    // Invalidate cache
    await base44.functions.invoke('invalidateSettingsCache', {});

    return Response.json({
      success: true,
      limit
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});