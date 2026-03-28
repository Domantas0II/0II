import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (role) => {
  const map = { admin: 'ADMINISTRATOR', user: 'SALES_AGENT' };
  return map[role] || role;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Service-level access to check all tasks
    const allTasks = await base44.asServiceRole.entities.Task.list('-created_date', 500);

    const now = new Date();
    let updated = 0;
    let escalated = 0;

    for (const task of allTasks) {
      // Skip completed/cancelled tasks
      if (task.status === 'completed' || task.status === 'cancelled') {
        continue;
      }

      const dueTime = new Date(task.dueAt);

      // Mark as overdue if past due
      if (dueTime < now && task.status !== 'overdue') {
        await base44.asServiceRole.entities.Task.update(task.id, {
          status: 'overdue'
        });
        updated++;
      }

      // Escalate if needed
      if (task.status === 'overdue' || (dueTime < now && task.status === 'in_progress')) {
        // Get SLA config for project
        const slaConfigs = await base44.asServiceRole.entities.SLAConfig.filter({
          projectId: task.projectId
        });
        const slaConfig = slaConfigs?.[0] || {
          escalationAfterMinutes: 60,
          escalationMaxLevel: 2
        };

        // Check if should escalate
        const minutesPastDue = Math.floor((now - dueTime) / 60000);
        const escalationThreshold = slaConfig.escalationAfterMinutes || 60;

        if (minutesPastDue > escalationThreshold && task.escalationLevel < slaConfig.escalationMaxLevel) {
          let newAssigneeId = task.assignedToUserId;

          // Escalate based on level
          if (task.escalationLevel === 0) {
            // Escalate to manager
            const managers = await base44.asServiceRole.entities.UserProjectAssignment.filter({
              projectId: task.projectId,
              removedAt: null
            });

            // Find first manager/admin
            for (const assignment of managers) {
              const assigneeUsers = await base44.asServiceRole.entities.User.filter({
                id: assignment.userId
              });
              if (assigneeUsers?.[0]) {
                const userRole = normalizeRole(assigneeUsers[0].role);
                if (userRole === 'SALES_MANAGER' || userRole === 'ADMINISTRATOR') {
                  newAssigneeId = assignment.userId;
                  break;
                }
              }
            }
          } else if (task.escalationLevel === 1) {
            // Escalate to admin
            const admins = await base44.asServiceRole.entities.User.list();
            for (const u of admins) {
              if (normalizeRole(u.role) === 'ADMINISTRATOR') {
                newAssigneeId = u.id;
                break;
              }
            }
          }

          // Update task with escalation
          await base44.asServiceRole.entities.Task.update(task.id, {
            escalationLevel: task.escalationLevel + 1,
            lastEscalatedAt: now.toISOString(),
            assignedToUserId: newAssigneeId,
            priority: 'critical'
          });

          escalated++;
        }
      }
    }

    return Response.json({
      success: true,
      tasksMarkedOverdue: updated,
      tasksEscalated: escalated,
      totalProcessed: allTasks.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});