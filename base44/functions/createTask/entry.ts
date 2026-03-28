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

    // Normalize role (consistent with other task functions)
    const normalizeRole = (r) => {
      const map = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
      return map[r] || r;
    };
    const role = normalizeRole(user.role);

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

    const assigneeRole = normalizeRole(assignees[0].role);
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

    // FIX #1: Validate source entities (ClientProjectInterest / Reservation)
    if (relatedInterestId) {
      const interests = await base44.entities.ClientProjectInterest.filter({
        id: relatedInterestId,
        projectId
      });
      if (!interests || interests.length === 0) {
        return Response.json({
          error: 'ClientProjectInterest not found or does not belong to this project'
        }, { status: 404 });
      }
      // If clientId provided, verify it matches
      if (clientId && interests[0].clientId !== clientId) {
        return Response.json({
          error: 'ClientProjectInterest does not belong to specified client'
        }, { status: 400 });
      }
    }

    if (relatedReservationId) {
      const reservations = await base44.entities.Reservation.filter({
        id: relatedReservationId,
        projectId
      });
      if (!reservations || reservations.length === 0) {
        return Response.json({
          error: 'Reservation not found or does not belong to this project'
        }, { status: 404 });
      }
      // If clientId provided, verify it matches
      if (clientId && reservations[0].clientId !== clientId) {
        return Response.json({
          error: 'Reservation does not belong to specified client'
        }, { status: 400 });
      }
    }

    // FIX #2: Cross-source sanity check
    if (relatedInterestId && relatedReservationId) {
      const interests = await base44.entities.ClientProjectInterest.filter({
        id: relatedInterestId,
        projectId
      });
      const reservations = await base44.entities.Reservation.filter({
        id: relatedReservationId,
        projectId
      });

      if (interests?.[0] && reservations?.[0]) {
        // Both must belong to same project (already checked above) and same client
        if (interests[0].clientId !== reservations[0].clientId) {
          return Response.json({
            error: 'ClientProjectInterest and Reservation must belong to same client'
          }, { status: 400 });
        }
      }
    }

    // DUPLICATION PREVENTION: Check if similar active task exists
    const duplicateQuery = {
      type,
      projectId,
      status: { $in: ['pending', 'in_progress'] }
    };

    if (relatedInterestId) {
      duplicateQuery.relatedInterestId = relatedInterestId;
    } else if (relatedReservationId) {
      duplicateQuery.relatedReservationId = relatedReservationId;
    }

    const existing = await base44.entities.Task.filter(duplicateQuery);
    if (existing && existing.length > 0) {
      return Response.json({
        error: 'Task already exists for this item',
        existingTaskId: existing[0].id,
        status: 400
      }, { status: 409 });
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