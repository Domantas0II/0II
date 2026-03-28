import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
      relatedReservationId,
      type,
      title,
      description,
      priority = 'medium',
      dueAt,
      assignedToUserId,
    } = await req.json();

    // Validate required fields
    if (!projectId || !type || !title || !dueAt || !assignedToUserId) {
      return Response.json({
        error: 'Missing required: projectId, type, title, dueAt, assignedToUserId'
      }, { status: 400 });
    }

    // Validate dueAt is in future
    if (new Date(dueAt) < new Date()) {
      return Response.json({
        error: 'dueAt must be in future'
      }, { status: 400 });
    }

    // Verify project exists and user has access
    const roleMap = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
    const role = roleMap[user.role] || user.role;

    if (role !== 'ADMINISTRATOR' && role !== 'SALES_MANAGER') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const projects = await base44.entities.Project.filter({ id: projectId });
    if (!projects || projects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // If MANAGER, verify access to project
    if (role === 'SALES_MANAGER') {
      const assignments = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId,
        removedAt: null
      });
      if (!assignments || assignments.length === 0) {
        return Response.json({ error: 'Access denied to project' }, { status: 403 });
      }
    }

    // Verify assignee exists and has project access
    const assignees = await base44.entities.User.filter({ id: assignedToUserId });
    if (!assignees || assignees.length === 0) {
      return Response.json({ error: 'Assignee not found' }, { status: 404 });
    }

    const assigneeRole = roleMap[assignees[0].role] || assignees[0].role;
    if (assigneeRole !== 'ADMINISTRATOR') {
      const assigneeAccess = await base44.entities.UserProjectAssignment.filter({
        userId: assignedToUserId,
        projectId,
        removedAt: null
      });
      if (!assigneeAccess || assigneeAccess.length === 0) {
        return Response.json({
          error: 'Assignee does not have access to this project'
        }, { status: 400 });
      }
    }

    // Create task
    const task = await base44.entities.Task.create({
      projectId,
      clientId: clientId || null,
      relatedInterestId: relatedInterestId || null,
      relatedReservationId: relatedReservationId || null,
      type,
      title,
      description: description || null,
      priority,
      dueAt,
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