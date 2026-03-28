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
    const queryProjectIds = url.searchParams.get('projectIds')?.split(',').filter(p => p) || [];
    const role = normalizeRole(user.role);

    // FIX #1: Consistent filter semantics for all roles
    let accessibleProjectIds = [];

    if (role === 'ADMINISTRATOR') {
      // Admin: full access
      // If projectIds requested, use them; otherwise all
      accessibleProjectIds = queryProjectIds.length > 0 ? queryProjectIds : null;
    } else if (role === 'SALES_MANAGER') {
      // Manager: can only access assigned projects
      const assignments = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        removedAt: null
      });
      const managerProjects = assignments.map(a => a.projectId);

      // If projectIds requested, intersect with accessible
      if (queryProjectIds.length > 0) {
        accessibleProjectIds = queryProjectIds.filter(p => managerProjects.includes(p));
      } else {
        accessibleProjectIds = managerProjects;
      }
    } else if (role === 'SALES_AGENT') {
      // Agent: no full pipeline access
      return Response.json({
        success: true,
        pipeline: [],
        message: 'Agents cannot view full pipeline'
      });
    } else {
      return Response.json({ error: 'Invalid role' }, { status: 403 });
    }

    // FIX #2: Clear access semantics
    // accessibleProjectIds === null means: admin full access (no filter)
    // accessibleProjectIds === [] means: no access to any project
    // accessibleProjectIds === [...] means: fetch only these projects

    let interests = [];
    if (accessibleProjectIds === null) {
      // Admin full access: fetch all interests
      interests = await base44.entities.ClientProjectInterest.list('-created_date', 500);
    } else if (accessibleProjectIds.length > 0) {
      // Fetch interests for each accessible project
      for (const pid of accessibleProjectIds) {
        const projectInterests = await base44.entities.ClientProjectInterest.filter({
          projectId: pid
        });
        interests = interests.concat(projectInterests || []);
      }
    }
    // If accessibleProjectIds is empty array, interests remain []

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