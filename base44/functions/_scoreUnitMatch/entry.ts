import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// FIX #1: Centralized scoreUnitMatch - shared scoring logic
async function scoreUnitMatch(units, project) {
  const results = [];

  for (const unit of units) {
    let score = 50;
    const reasons = [];

    // Factor 1: Project match
    if (unit.projectId === project.id) {
      score += 10;
      reasons.push({
        factor: 'same_project',
        weight: 10,
        explanation: 'Unit tame pačiame projekte'
      });
    }

    // Factor 2: Status available (hard requirement)
    if (unit.internalStatus === 'available') {
      score += 20;
      reasons.push({
        factor: 'unit_available',
        weight: 20,
        explanation: 'Unit yra laisvai parduodamas'
      });
    } else {
      // Unavailable units get 0 score - not recommended
      results.push({
        unitId: unit.id,
        matchScore: 0,
        matchReasonsJson: JSON.stringify([{
          factor: 'unit_not_available',
          weight: -100,
          explanation: 'Unit nėra laisvai'
        }])
      });
      continue;
    }

    // Factor 3: Price range heuristic
    score += 5;
    reasons.push({
      factor: 'price_range_match',
      weight: 5,
      explanation: 'Price range rekomenduojamas'
    });

    // Factor 4: Area match
    if (unit.areaM2 >= 30 && unit.areaM2 <= 200) {
      score += 5;
      reasons.push({
        factor: 'area_reasonable',
        weight: 5,
        explanation: `Plotas ${unit.areaM2}m² yra pagrindinis`
      });
    }

    // Factor 5: Public status as soft signal (not hard filter)
    if (unit.isPublic) {
      score += 3;
      reasons.push({
        factor: 'unit_public',
        weight: 3,
        explanation: 'Unit viešai rodomas - soft signal'
      });
    }

    results.push({
      unitId: unit.id,
      matchScore: Math.min(100, score),
      matchReasonsJson: JSON.stringify(reasons)
    });
  }

  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { units, project } = await req.json();

    if (!units || !project) {
      return Response.json({ error: 'units and project required' }, { status: 400 });
    }

    const matches = await scoreUnitMatch(units, project);

    return Response.json({
      success: true,
      matches
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});