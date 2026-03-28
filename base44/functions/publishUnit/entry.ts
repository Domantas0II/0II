import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (role) => {
  const map = { admin: 'ADMINISTRATOR', user: 'SALES_AGENT' };
  return map[role] || role;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (normalizeRole(user.role) !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { unitId } = await req.json();

    if (!unitId) {
      return Response.json({ error: 'unitId required' }, { status: 400 });
    }

    // Fetch unit
    const units = await base44.entities.SaleUnit.filter({ id: unitId });
    if (!units || units.length === 0) {
      return Response.json({ error: 'Unit not found' }, { status: 404 });
    }

    const unit = units[0];

    // Validate: can only publish if:
    // 1. internalStatus === 'available'
    // 2. project.isPublic === true
    if (unit.internalStatus !== 'available') {
      return Response.json({
        error: `Unit status must be "available", current: ${unit.internalStatus}`
      }, { status: 400 });
    }

    // Fetch project
    const projects = await base44.entities.Project.filter({ id: unit.projectId });
    if (!projects || projects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    if (!project.isPublic) {
      return Response.json({
        error: 'Project must be public before publishing units'
      }, { status: 400 });
    }

    // Update unit
    await base44.entities.SaleUnit.update(unitId, {
      isPublic: true
    });

    return Response.json({
      success: true,
      message: 'Unit published successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});