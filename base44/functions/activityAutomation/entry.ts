import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    // When activity is created with type=consultation or visit
    // Update ClientProjectInterest.pipelineStage
    if (event.type === 'create' && event.entity_name === 'Activity') {
      const activity = data;

      if (!activity.clientId || !activity.projectId) {
        return Response.json({ success: false, error: 'Missing clientId or projectId' }, { status: 400 });
      }

      let newStage = null;
      if (activity.type === 'consultation') {
        newStage = 'consultation';
      } else if (activity.type === 'visit') {
        newStage = 'visit';
      }

      if (newStage) {
        // Find the ClientProjectInterest
        const interests = await base44.asServiceRole.entities.ClientProjectInterest.filter({
          clientId: activity.clientId,
          projectId: activity.projectId,
        });

        if (interests && interests.length > 0) {
          const interest = interests[0];
          await base44.asServiceRole.entities.ClientProjectInterest.update(interest.id, {
            pipelineStage: newStage,
            stageUpdatedAt: new Date().toISOString(),
            lastInteractionAt: new Date().toISOString(),
          });
        }
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});