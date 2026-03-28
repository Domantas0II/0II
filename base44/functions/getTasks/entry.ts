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

    // Parse query params
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const assignedToUserId = url.searchParams.get('assignedToUserId');

    const role = normalizeRole(user.role);

    let filterQuery = {};

    // Agent: only their tasks
    if (role === 'SALES_AGENT') {
      filterQuery.assignedToUserId = user.id;
      if (projectId) {
        filterQuery.projectId = projectId;
      }
    }
    // Manager: project tasks
    else if (role === 'SALES_MANAGER') {
      if (!projectId) {
        return Response.json({ error: 'projectId required for manager' }, { status: 400 });
      }

      // Verify manager has project access
      const access = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId,
        removedAt: null
      });
      if (!access || access.length === 0) {
        return Response.json({ error: 'Access denied to project' }, { status: 403 });
      }

      filterQuery.projectId = projectId;

      if (assignedToUserId) {
        filterQuery.assignedToUserId = assignedToUserId;
      }
    }
    // Admin: all tasks
    else if (role === 'ADMINISTRATOR') {
      if (projectId) {
        filterQuery.projectId = projectId;
      }
      if (assignedToUserId) {
        filterQuery.assignedToUserId = assignedToUserId;
      }
    } else {
      return Response.json({ error: 'Invalid role' }, { status: 403 });
    }

    // Apply status and priority filters
    if (status) {
      filterQuery.status = status;
    }
    if (priority) {
      filterQuery.priority = priority;
    }

    // FIX #3: Query hardening with limit
    // Base44 filter API does not support native limit/offset parameters in query
    // Therefore: fetch all matching records (bounded by filterQuery constraints)
    // then apply client-side limit (TASK_LIMIT = 200)
    // This is safe because filterQuery already restricts by role/project/status
    // See: https://docs.base44.dev/sdk - no limit/skip in filter() API
    const allTasks = await base44.entities.Task.filter(filterQuery);
    const TASK_LIMIT = 200;
    const tasks = (allTasks || []).slice(0, TASK_LIMIT);

    // Sort by dueAt ascending
    const sorted = tasks.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

    return Response.json({
      success: true,
      tasks: sorted,
      count: sorted.length,
      limited: (allTasks?.length || 0) > TASK_LIMIT,
      totalAvailable: allTasks?.length || 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});