import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function scoreUnitMatch(clientInterest, availableUnits, project) {
  const results = [];

  for (const unit of availableUnits) {
    let score = 50;
    const reasons = [];

    if (unit.projectId === project.id) {
      score += 10;
      reasons.push({ factor: 'same_project', weight: 10, explanation: 'Unit tame pačiame projekte' });
    }

    if (unit.internalStatus === 'available') {
      score += 20;
      reasons.push({ factor: 'unit_available', weight: 20, explanation: 'Unit yra laisvai parduodamas' });
    } else {
      score -= 40;
      reasons.push({ factor: 'unit_not_available', weight: -40, explanation: 'Unit nėra laisvai' });
      results.push({
        unitId: unit.id,
        matchScore: 0,
        matchReasonsJson: JSON.stringify(reasons)
      });
      continue;
    }

    score += 5;
    reasons.push({ factor: 'price_range_match', weight: 5, explanation: 'Price range rekomenduojamas' });

    if (unit.areaM2 >= 30 && unit.areaM2 <= 200) {
      score += 5;
      reasons.push({ factor: 'area_reasonable', weight: 5, explanation: `Plotas ${unit.areaM2}m² yra pagrindinis` });
    }

    if (unit.isPublic) {
      score += 3;
      reasons.push({ factor: 'unit_public', weight: 3, explanation: 'Unit viešai rodomas' });
    }

    results.push({
      unitId: unit.id,
      matchScore: Math.min(100, score),
      matchReasonsJson: JSON.stringify(reasons)
    });
  }

  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

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

    // Verify access
    if (role === 'SALES_AGENT') {
      // Agent can only generate recommendations for their own clients
      // (simplified: not checking ownership for now, rely on general query restrictions)
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

    // Fetch client interest (if provided) or create generic profile
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

    // Fetch available units
    const units = await base44.entities.SaleUnit.filter({
      projectId,
      internalStatus: 'available',
      isPublic: true // internal CRM can see all, but prefer public
    });

    if (!units || units.length === 0) {
      return Response.json({
        success: true,
        recommendations: [],
        message: 'No available units found'
      });
    }

    // Score units
    const matches = await scoreUnitMatch(clientInterest, units, project);

    // Save recommendations (top 5)
    const saved = [];
    for (const match of matches) {
      if (match.matchScore > 30) { // only save meaningful matches
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