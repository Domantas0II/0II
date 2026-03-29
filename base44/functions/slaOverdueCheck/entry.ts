import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Role normalization and system settings helpers (copied to avoid import deps)
const normalizeRole = (role) => {
  const map = { admin: 'ADMINISTRATOR', user: 'SALES_AGENT' };
  return map[role] || role;
};

// GOVERNANCE: Get system setting from database
async function getSettingValue(key, defaultValue = null, base44) {
  try {
    const settings = await base44.asServiceRole.entities.SystemSetting.filter({ key });
    if (settings && settings.length > 0) {
      return JSON.parse(settings[0].valueJson);
    }
  } catch (error) {
    console.warn(`Failed to fetch setting ${key}:`, error.message);
  }
  return defaultValue;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // FIX #3: Query reliability - use explicit status matches instead of $nin operator
    // This ensures compatibility with Base44's filter engine
    // Fetch only active tasks: pending, in_progress, overdue (3 separate queries)
    const pendingTasks = await base44.asServiceRole.entities.Task.filter({ status: 'pending' });
    const inProgressTasks = await base44.asServiceRole.entities.Task.filter({ status: 'in_progress' });
    const overdueTasks = await base44.asServiceRole.entities.Task.filter({ status: 'overdue' });
    const allTasks = [
      ...(pendingTasks || []),
      ...(inProgressTasks || []),
      ...(overdueTasks || [])
    ];

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
        // GOVERNANCE FIX: Use SystemSetting for SLA parameters (centralized)
        const escalationAfterMinutes = await getSettingValue('sla.escalationAfterMinutes', 60, base44);
        const escalationMaxLevel = await getSettingValue('sla.maxEscalationLevel', 2, base44);
        
        const slaConfig = {
          escalationAfterMinutes,
          escalationMaxLevel
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
              // FIX #4: Admin search is done by raw role:'admin' query for performance
              // Rationale: Base44 User.role field stores 'admin' or 'user' as-is
              // Post-fetch normalization via normalizeRole() ensures role consistency
              // This approach avoids scanning all users + filtering in-memory
              // The normalizeRole check (line 115) is mandatory safety gate
              const adminUsers = await base44.asServiceRole.entities.User.filter({
                role: 'admin'
              });
              let found = false;
              for (const u of adminUsers || []) {
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