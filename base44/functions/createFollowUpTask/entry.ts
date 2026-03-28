import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Auto-create follow-up tasks based on triggers:
 * - New ClientProjectInterest (contacted stage)
 * - Activity completion (call/meeting)
 * - Manual follow-up request
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      projectId,
      clientId,
      relatedInterestId,
      daysUntilDue = 1,
      priority = 'medium',
      assignedToUserId
    } = await req.json();

    if (!projectId || !relatedInterestId || !assignedToUserId) {
      return Response.json({
        error: 'Missing: projectId, relatedInterestId, assignedToUserId'
      }, { status: 400 });
    }

    // Check duplication
    const existing = await base44.entities.Task.filter({
      projectId,
      relatedInterestId,
      type: 'follow_up',
      status: { $in: ['pending', 'in_progress'] }
    });

    if (existing && existing.length > 0) {
      return Response.json({
        error: 'Follow-up task already exists',
        existingTaskId: existing[0].id
      }, { status: 409 });
    }

    // Create follow-up task
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + daysUntilDue);

    const task = await base44.entities.Task.create({
      projectId,
      clientId: clientId || null,
      relatedInterestId,
      type: 'follow_up',
      title: `Follow-up: susisiekti su klientu`,
      description: 'Skambinti ar rašyti žinutę dėl projekto.',
      priority,
      dueAt: dueAt.toISOString(),
      assignedToUserId,
      createdByUserId: user.id,
      status: 'pending',
      escalationLevel: 0
    });

    return Response.json({
      success: true,
      task
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});