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

      // 1. MARK AS OVERDUE if past due
      if (dueTime < now && task.status !== 'overdue') {
        await base44.asServiceRole.entities.Task.update(task.id, {
          status: 'overdue'
        });
        updated++;
      }

      // 2. ESCALATION LOGIC
      if (task.status === 'overdue' || dueTime < now) {
        // Fetch SLA config for project
        const slaConfigs = await base44.asServiceRole.entities.SLAConfig.filter({
          projectId: task.projectId
        });
        const slaConfig = slaConfigs?.[0] || {
          escalationAfterMinutes: 60,
          escalationMaxLevel: 2
        };

        // IDEMPOTENCY: Check if we've already escalated recently (within 5 min)
        const lastEscalated = task.lastEscalatedAt ? new Date(task.lastEscalatedAt) : null;
        const minutesSinceLastEscalation = lastEscalated ? (now - lastEscalated) / 60000 : Infinity;

        // Only escalate if enough time has passed AND we haven't hit max level
        if (
          task.escalationLevel < slaConfig.escalationMaxLevel &&
          minutesSinceLastEscalation > 5
        ) {
          const minutesPastDue = Math.floor((now - dueTime) / 60000);
          const escalationThreshold = slaConfig.escalationAfterMinutes || 60;

          // Check if time threshold is met
          if (minutesPastDue > escalationThreshold) {
            let newAssigneeId = task.assignedToUserId;

            // Escalate based on level
            if (task.escalationLevel === 0) {
              // Level 0→1: Escalate to manager
              const assignments = await base44.asServiceRole.entities.UserProjectAssignment.filter({
                projectId: task.projectId,
                removedAt: null
              });

              // Find first manager/admin
              let found = false;
              for (const assignment of assignments) {
                const assigneeUsers = await base44.asServiceRole.entities.User.filter({
                  id: assignment.userId
                });
                if (assigneeUsers?.[0]) {
                  const userRole = normalizeRole(assigneeUsers[0].role);
                  if (userRole === 'SALES_MANAGER' || userRole === 'ADMINISTRATOR') {
                    newAssigneeId = assignment.userId;
                    found = true;
                    break;
                  }
                }
              }

              if (found) {
                await base44.asServiceRole.entities.Task.update(task.id, {
                  escalationLevel: 1,
                  lastEscalatedAt: now.toISOString(),
                  assignedToUserId: newAssigneeId,
                  priority: 'critical'
                });
                escalated++;
              }
            } else if (task.escalationLevel === 1) {
              // Level 1→2: Escalate to admin
              const allUsers = await base44.asServiceRole.entities.User.list();
              let found = false;
              for (const u of allUsers) {
                if (normalizeRole(u.role) === 'ADMINISTRATOR') {
                  newAssigneeId = u.id;
                  found = true;
                  break;
                }
              }

              if (found) {
                await base44.asServiceRole.entities.Task.update(task.id, {
                  escalationLevel: 2,
                  lastEscalatedAt: now.toISOString(),
                  assignedToUserId: newAssigneeId,
                  priority: 'critical'
                });
                escalated++;
              }
            }
            // Level 2+: Stop escalation
          }
        }
      }
    }

    return Response.json({
      success: true,
      tasksMarkedOverdue: updated,
      tasksEscalated: escalated,
      totalProcessed: allTasks.length,
      timestamp: now.toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});