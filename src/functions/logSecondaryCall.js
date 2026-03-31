/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId, pipelineType, callTime, comment, nextStage } = await req.json();

    // Log call activity
    const activityData = {
      type: 'call',
      status: 'done',
      completedAt: new Date().toISOString(),
      notes: comment || '',
      callTime,
      soldByUserId: user.id
    };

    // Create activity for the item
    if (pipelineType === 'objects') {
      // Log as activity for secondary object context
      await base44.entities.Activity.create({
        clientId: itemId,
        projectId: null,
        type: 'call',
        status: 'done',
        completedAt: new Date().toISOString(),
        notes: `[Secondary Call] ${comment || ''}`,
        soldByUserId: user.id,
        createdByUserId: user.id
      });

      // Update object stage if provided
      if (nextStage) {
        await base44.entities.SecondaryObject.update(itemId, {
          status: nextStage === 'sold' ? 'sold' : nextStage === 'offer_received' ? 'reserved' : 'available'
        });
      }
    } else {
      // Log for buyer profile
      await base44.entities.Activity.create({
        clientId: itemId,
        projectId: null,
        type: 'call',
        status: 'done',
        completedAt: new Date().toISOString(),
        notes: `[Secondary Buyer Call] ${comment || ''}`,
        soldByUserId: user.id,
        createdByUserId: user.id
      });

      // Update buyer profile stage if provided
      if (nextStage) {
        await base44.entities.SecondaryBuyerProfile.update(itemId, {
          status: nextStage === 'purchased' ? 'completed' : nextStage === 'negotiating' ? 'active' : 'paused'
        });
      }
    }

    await base44.entities.AuditLog.create({
      action: 'SECONDARY_CALL_LOGGED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ itemId, pipelineType, callTime })
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});