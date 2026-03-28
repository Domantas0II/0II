import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { projectId } = await req.json();

    if (!projectId) {
      return Response.json({ error: 'projectId required' }, { status: 400 });
    }

    // Update project
    await base44.entities.Project.update(projectId, {
      isPublic: false,
      publicStatus: 'draft'
    });

    // Cascade: unpublish all units in this project
    const units = await base44.entities.SaleUnit.filter({
      projectId: projectId,
      isPublic: true
    });

    for (const unit of units) {
      await base44.entities.SaleUnit.update(unit.id, {
        isPublic: false
      });
    }

    return Response.json({
      success: true,
      message: 'Project unpublished successfully, all units hidden'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});