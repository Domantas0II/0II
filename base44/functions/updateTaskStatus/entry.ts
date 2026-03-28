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

    const { taskId, newStatus } = await req.json();

    if (!taskId || !newStatus) {
      return Response.json({ error: 'taskId and newStatus required' }, { status: 400 });
    }

    // Fetch task
    const tasks = await base44.entities.Task.filter({ id: taskId });
    if (!tasks || tasks.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];

    // Access control: user can only update their own tasks, unless manager/admin
    const role = normalizeRole(user.role);
    if (role !== 'ADMINISTRATOR' && role !== 'SALES_MANAGER' && task.assignedToUserId !== user.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Manager/Admin need project access
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

    // Update task
    const updateData = { status: newStatus };
    if (newStatus === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    await base44.entities.Task.update(taskId, updateData);

    return Response.json({
      success: true,
      message: 'Task updated'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});