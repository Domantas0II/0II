import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Automation: runs when ProjectCompleteness updates
// Syncs publicStatus based on completeness percentage
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!event || event.type !== 'update') {
      return Response.json({ skip: true });
    }

    const projectId = data.projectId;
    if (!projectId) {
      return Response.json({ error: 'projectId required' }, { status: 400 });
    }

    // Fetch the completeness record
    const completeness = await base44.entities.ProjectCompleteness.filter({
      projectId: projectId
    });

    if (!completeness || completeness.length === 0) {
      return Response.json({ skip: true });
    }

    const comp = completeness[0];

    // Fetch project
    const projects = await base44.entities.Project.filter({ id: projectId });
    if (!projects || projects.length === 0) {
      return Response.json({ skip: true });
    }

    const project = projects[0];

    // Logic:
    // - If completeness < 100% → publicStatus = draft
    // - If completeness >= 100% → publicStatus = ready (but not published yet)
    let newStatus = 'draft';
    if (comp.readyForOperations === true) {
      newStatus = 'ready';
    }

    // Only update if changed
    if (project.publicStatus !== newStatus) {
      await base44.entities.Project.update(projectId, {
        publicStatus: newStatus
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('syncPublishStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});