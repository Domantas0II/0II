import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get all activities
    const activities = await base44.asServiceRole.entities.Activity.list('-created_date', 1000);
    
    // Get all projects
    const projects = await base44.asServiceRole.entities.Project.list();
    const projectIds = new Set(projects.map(p => p.id));

    let cleaned = 0;
    let checked = 0;

    // Process each activity
    for (const activity of activities) {
      checked++;
      
      // Skip if already cancelled
      if (activity.status === 'cancelled') continue;

      // Check if projectId is missing or invalid
      if (!activity.projectId || !projectIds.has(activity.projectId)) {
        await base44.asServiceRole.entities.Activity.update(activity.id, {
          status: 'cancelled',
          notes: (activity.notes || '') + ' [Legacy orphan activity - no valid project]'
        });
        cleaned++;
      }
    }

    return Response.json({
      checked,
      cleaned,
      message: `Cleaned ${cleaned} orphan activities out of ${checked} checked`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});