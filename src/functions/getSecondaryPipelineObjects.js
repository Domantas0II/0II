/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all secondary objects with their current stage
    const objects = await base44.asServiceRole.entities.SecondaryObject.list('-created_date', 500);

    // Add stage based on status (simplified logic)
    const withStage = objects.map(obj => ({
      ...obj,
      stage: obj.status === 'available' ? 'new_object' : obj.status === 'reserved' ? 'offer_received' : obj.status === 'sold' ? 'sold' : 'active_listing'
    }));

    return Response.json({ data: withStage }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});