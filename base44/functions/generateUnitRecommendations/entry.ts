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

    const { clientId, projectId, interestId } = await req.json();

    if (!clientId || !projectId) {
      return Response.json({ error: 'clientId and projectId required' }, { status: 400 });
    }

    const role = normalizeRole(user.role);

    // FIX #3: Agent access control - enforce real restrictions
    if (role === 'SALES_AGENT') {
      // Agent must have explicit project access
      const assignments = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId,
        removedAt: null
      });
      if (!assignments || assignments.length === 0) {
        return Response.json({ error: 'Access denied to project' }, { status: 403 });
      }

      // If interestId provided, verify it belongs to agent's scope
      if (interestId) {
        const interests = await base44.entities.ClientProjectInterest.filter({
          id: interestId,
          projectId
        });
        if (!interests || interests.length === 0) {
          return Response.json({ error: 'Interest not found or access denied' }, { status: 403 });
        }
      }
    } else if (role === 'SALES_MANAGER') {
      const access = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId,
        removedAt: null
      });
      if (!access || access.length === 0) {
        return Response.json({ error: 'Access denied to project' }, { status: 403 });
      }
    } else if (role !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch client interest (if provided)
    let clientInterest = null;
    if (interestId) {
      const interests = await base44.entities.ClientProjectInterest.filter({ id: interestId });
      if (interests && interests.length > 0) {
        clientInterest = interests[0];
      }
    }

    // Fetch project
    const projects = await base44.entities.Project.filter({ id: projectId });
    if (!projects || projects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    const project = projects[0];

    // FIX #4: Internal recommendation uses internalStatus: available, NOT isPublic filter
    // isPublic is public visibility control, not internal CRM scope
    const units = await base44.entities.SaleUnit.filter({
      projectId,
      internalStatus: 'available'
    });

    if (!units || units.length === 0) {
      return Response.json({
        success: true,
        recommendations: [],
        message: 'No available units found'
      });
    }

    // FIX #1: Use centralized scoreUnitMatch with interest signals
    // FIX #5: Pass interest context for better matching (if available)
    const scoreResponse = await base44.functions.invoke('_scoreUnitMatch', {
      units,
      project,
      clientInterest: clientInterest ? {
        pipelineStage: clientInterest.pipelineStage,
        status: clientInterest.status
      } : null
    });

    const matches = scoreResponse.data?.matches || [];

    // Save recommendations (top 5)
    const saved = [];
    for (const match of matches) {
      if (match.matchScore > 30) {
        const rec = await base44.entities.UnitRecommendation.create({
          projectId,
          clientId,
          interestId: interestId || null,
          unitId: match.unitId,
          matchScore: match.matchScore,
          matchReasonsJson: match.matchReasonsJson,
          recommendedAt: new Date().toISOString()
        });
        saved.push(rec);
      }
    }

    return Response.json({
      success: true,
      recommendationsCreated: saved.length,
      recommendations: saved
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});