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
    const role = normalizeRole(user.role);

    // Determine accessible projects
    let queryProjectIds = projectIds;
    if (role === 'SALES_MANAGER') {
      const assignments = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        removedAt: null
      });
      queryProjectIds = assignments.map(a => a.projectId);
    } else if (role === 'SALES_AGENT') {
      // Agent limited to their assigned interests
      return Response.json({
        success: true,
        pipeline: [],
        message: 'Agents cannot view full pipeline'
      });
    }

    // Fetch interests for projects
    let interests = [];
    if (queryProjectIds.length > 0) {
      for (const pid of queryProjectIds) {
        const projectInterests = await base44.entities.ClientProjectInterest.filter({
          projectId: pid
        });
        interests = interests.concat(projectInterests || []);
      }
    } else {
      interests = await base44.entities.ClientProjectInterest.list('-created_date', 500);
    }

    // FIX #2: Real scoring - generate if missing, don't use fake fallback
    const pipeline = [];
    for (const interest of (interests || []).slice(0, 200)) {
      const scores = await base44.entities.LeadScore.filter({
        interestId: interest.id
      });

      let reservationScore = scores?.find(s => s.scoreType === 'reservation_probability');
      let dealScore = scores?.find(s => s.scoreType === 'deal_probability');

      // If scores missing, generate them now
      if (!reservationScore || !dealScore) {
        const generateRes = await base44.functions.invoke('generateLeadScores', {
          projectId: interest.projectId,
          clientId: interest.clientId,
          interestId: interest.id
        });

        if (generateRes.data?.scores) {
          const generated = generateRes.data.scores;
          reservationScore = generated.find(s => s.scoreType === 'reservation_probability') || reservationScore;
          dealScore = generated.find(s => s.scoreType === 'deal_probability') || dealScore;
        }
      }

      // Only include if we have real scores, or skip entirely (no fake fallback)
      if (reservationScore || dealScore) {
        pipeline.push({
          interestId: interest.id,
          clientId: interest.clientId,
          projectId: interest.projectId,
          status: interest.status,
          pipelineStage: interest.pipelineStage,
          lastInteractionAt: interest.lastInteractionAt,
          nextFollowUpAt: interest.nextFollowUpAt,
          reservationScore: reservationScore?.scoreValue || null,
          reservationBand: reservationScore?.band || null,
          dealScore: dealScore?.scoreValue || null,
          dealBand: dealScore?.band || null
        });
      }
    }

    // Group by stage
    const stages = ['new', 'contacted', 'consultation', 'visit', 'negotiation', 'reserved', 'won', 'lost'];
    const grouped = {};
    stages.forEach(s => grouped[s] = []);
    
    pipeline.forEach(item => {
      if (grouped[item.pipelineStage]) {
        grouped[item.pipelineStage].push(item);
      }
    });

    // Sort within each stage by score
    Object.keys(grouped).forEach(stage => {
      grouped[stage].sort((a, b) => b.reservationScore - a.reservationScore);
    });

    return Response.json({
      success: true,
      pipeline: grouped,
      totalCount: pipeline.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});