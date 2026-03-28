import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => {
  const map = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
  return map[r] || r;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const projectIds = url.searchParams.get('projectIds')?.split(',') || [];
    const assignedUserId = url.searchParams.get('assignedUserId');

    const role = normalizeRole(user.role);

    // Role-based filtering
    let queryProjectIds = projectIds;
    if (role === 'SALES_AGENT') {
      // Agent sees only their assigned tasks/clients
      // For priority queue: fetch their tasks
      const tasks = await base44.entities.Task.filter({
        assignedToUserId: user.id,
        status: { $in: ['pending', 'in_progress', 'overdue'] }
      });

      const clientIds = new Set();
      tasks.forEach(t => {
        if (t.clientId) clientIds.add(t.clientId);
      });

      if (clientIds.size === 0) {
        return Response.json({ success: true, queue: [] });
      }

      // Build queue from tasks
      const queue = [];
      for (const task of tasks) {
        const scores = await base44.entities.LeadScore.filter({
          clientId: task.clientId,
          scoreType: 'client_priority'
        });

        const topScore = scores?.[0];
        queue.push({
          type: 'task',
          taskId: task.id,
          clientId: task.clientId,
          title: task.title,
          priority: task.priority,
          dueAt: task.dueAt,
          status: task.status,
          scoreValue: topScore?.scoreValue || 50,
          band: topScore?.band || 'medium',
          recommendedAction: topScore?.recommendedAction || 'send_followup'
        });
      }

      queue.sort((a, b) => b.scoreValue - a.scoreValue);
      return Response.json({
        success: true,
        queue: queue.slice(0, 50),
        count: queue.length
      });
    } else if (role === 'SALES_MANAGER') {
      // Manager sees their project tasks
      if (projectIds.length === 0) {
        const assignments = await base44.entities.UserProjectAssignment.filter({
          userId: user.id,
          removedAt: null
        });
        queryProjectIds = assignments.map(a => a.projectId);
      }
    }
    // Admin: sees all

    // Fetch all open lead scores for these projects (limit 200)
    const leadsScores = await base44.entities.LeadScore.filter({
      band: { $in: ['high', 'critical'] }
    });

    const queue = [];
    for (const score of (leadsScores || []).slice(0, 200)) {
      if (queryProjectIds.length > 0 && !queryProjectIds.includes(score.projectId)) continue;
      if (assignedUserId && score.createdByUserId && score.createdByUserId !== assignedUserId) continue;

      let entityName = score.scoreType;
      let entityId = score.inquiryId || score.clientId || score.interestId;

      queue.push({
        scoreId: score.id,
        type: score.scoreType,
        entityId,
        scoreValue: score.scoreValue,
        band: score.band,
        reasonsJson: score.reasonsJson,
        recommendationText: score.recommendationText,
        recommendedAction: score.recommendedAction,
        generatedAt: score.generatedAt,
        expiresAt: score.expiresAt
      });
    }

    queue.sort((a, b) => {
      const bandOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      if (bandOrder[a.band] !== bandOrder[b.band]) {
        return bandOrder[b.band] - bandOrder[a.band];
      }
      return b.scoreValue - a.scoreValue;
    });

    return Response.json({
      success: true,
      queue: queue.slice(0, 50),
      count: queue.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});