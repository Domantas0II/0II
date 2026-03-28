import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (role) => {
  const map = { admin: 'ADMINISTRATOR', user: 'SALES_AGENT' };
  return map[role] || role;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId, newAssigneeId } = await req.json();

    if (!taskId || !newAssigneeId) {
      return Response.json({ error: 'taskId and newAssigneeId required' }, { status: 400 });
    }

    const role = normalizeRole(user.role);

    // Only manager/admin can reassign
    if (role !== 'SALES_MANAGER' && role !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Only managers/admins can reassign tasks' }, { status: 403 });
    }

    // Fetch task
    const tasks = await base44.entities.Task.filter({ id: taskId });
    if (!tasks || tasks.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];

    // Manager can only reassign within their project
    if (role === 'SALES_MANAGER') {
      const access = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId: task.projectId,
        removedAt: null
      });
      if (!access || access.length === 0) {
        return Response.json({ error: 'Access denied to project' }, { status: 403 });
      }
    }

    // Verify new assignee exists and has project access
    const assignees = await base44.entities.User.filter({ id: newAssigneeId });
    if (!assignees || assignees.length === 0) {
      return Response.json({ error: 'Assignee not found' }, { status: 404 });
    }

    const assigneeRole = normalizeRole(assignees[0].role);
    if (assigneeRole !== 'ADMINISTRATOR') {
      const assigneeAccess = await base44.entities.UserProjectAssignment.filter({
        userId: newAssigneeId,
        projectId: task.projectId,
        removedAt: null
      });
      if (!assigneeAccess || assigneeAccess.length === 0) {
        return Response.json({
          error: 'Assignee does not have access to this project'
        }, { status: 400 });
      }
    }

    // Reassign task
    await base44.entities.Task.update(taskId, {
      assignedToUserId: newAssigneeId,
      escalationLevel: 0, // Reset escalation on manual reassignment
      lastEscalatedAt: null
    });

    return Response.json({
      success: true,
      message: 'Task reassigned'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});