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
      priority = 'medium',
      assignedToUserId
    } = await req.json();

    if (!projectId || !relatedInterestId || !assignedToUserId) {
      return Response.json({
        error: 'Missing: projectId, relatedInterestId, assignedToUserId'
      }, { status: 400 });
    }

    // FIX #2: Validate source entity (ClientProjectInterest) exists and belongs to project
    const interests = await base44.entities.ClientProjectInterest.filter({
      id: relatedInterestId,
      projectId
    });

    if (!interests || interests.length === 0) {
      return Response.json({
        error: 'ClientProjectInterest not found or does not belong to this project'
      }, { status: 404 });
    }

    // FIX #1: Validate assignee has access to project
    const assignees = await base44.entities.User.filter({
      id: assignedToUserId
    });

    if (!assignees || assignees.length === 0) {
      return Response.json({
        error: 'Assignee user not found'
      }, { status: 404 });
    }

    const assigneeRole = assignees[0].role;
    // Admin users have access to all projects
    if (assigneeRole !== 'admin') {
      const assigneeAccess = await base44.entities.UserProjectAssignment.filter({
        userId: assignedToUserId,
        projectId,
        removedAt: null
      });
      if (!assigneeAccess || assigneeAccess.length === 0) {
        return Response.json({
          error: 'Assignee does not have access to this project'
        }, { status: 403 });
      }
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

    // Fetch SLAConfig to determine follow-up interval
    const slaConfigs = await base44.entities.SLAConfig.filter({
      projectId
    });
    const slaConfig = slaConfigs?.[0];
    const followUpHours = slaConfig?.followUpIntervalHours || 24; // Default 24 hours if no config

    // Create follow-up task: dueAt = now + SLAConfig.followUpIntervalHours
    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + followUpHours);

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