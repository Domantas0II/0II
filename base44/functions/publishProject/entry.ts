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

    // Fetch project
    const project = await base44.entities.Project.filter({ id: projectId });
    if (!project || project.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const proj = project[0];

    // Validate: can only publish if:
    // 1. projectLifecycleState === 'published'
    // 2. isActive === true
    // 3. publicStatus === 'ready' (from automation based on completeness)
    if (proj.projectLifecycleState !== 'published') {
      return Response.json({
        error: 'Project lifecycle must be "published" to make it public'
      }, { status: 400 });
    }

    if (!proj.isActive) {
      return Response.json({
        error: 'Project must be active'
      }, { status: 400 });
    }

    if (proj.publicStatus !== 'ready') {
      return Response.json({
        error: 'Project must be in "ready" status before publishing'
      }, { status: 400 });
    }

    // Validate completeness
    const completeness = await base44.entities.ProjectCompleteness.filter({
      projectId: projectId
    });

    if (!completeness || completeness.length === 0 || !completeness[0].readyForOperations) {
      return Response.json({
        error: 'Project completeness not ready for public publication'
      }, { status: 400 });
    }

    // Update project
    await base44.entities.Project.update(projectId, {
      isPublic: true,
      publicStatus: 'published'
    });

    return Response.json({
      success: true,
      message: 'Project published successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});