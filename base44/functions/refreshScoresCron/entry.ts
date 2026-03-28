import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function scoreReservationProbability(interest, activities, units) {
  let score = 40;
  const reasons = [];

  const stageWeights = {
    new: 5, contacted: 10, consultation: 15, visit: 25, negotiation: 40, reserved: 80, won: 95
  };
  const stageWeight = stageWeights[interest.pipelineStage] || 5;
  score += stageWeight;
  reasons.push({
    factor: 'pipeline_stage',
    weight: stageWeight,
    explanation: `Pipeline stadija: ${interest.pipelineStage}`
  });

  if (interest.lastInteractionAt) {
    const interactionDate = new Date(interest.lastInteractionAt);
    const ageHours = (new Date() - interactionDate) / (1000 * 60 * 60);
    
    if (ageHours < 24) {
      score += 15;
      reasons.push({ factor: 'recent_interaction', weight: 15, explanation: 'Kontaktas per paskutines 24h' });
    } else if (ageHours > 7 * 24) {
      score -= 15;
      reasons.push({ factor: 'stale_interest', weight: -15, explanation: 'Kontaktas buvo daugiau nei 7 dienos atgal' });
    }
  }

  const band = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: score >= 70 ? 'Aktyviai bendrauti, siūlyti rezervaciją' : 'Tęsti nurodytas veiklas',
    recommendedAction: score >= 70 ? 'propose_units' : 'send_followup'
  };
}

/**
 * Cron function: Refresh lead scores hourly
 * - Mark expired scores
 * - Recalculate for high-priority entities (interests, clients with recent activity)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all non-expired scores (last 24h)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentScores = await base44.asServiceRole.entities.LeadScore.filter({
      generatedAt: { $gte: cutoffDate.toISOString() }
    });

    let expired = 0;
    let refreshed = 0;

    // Mark expired scores
    for (const score of (recentScores || []).slice(0, 200)) {
      if (score.expiresAt && new Date(score.expiresAt) < new Date()) {
        // In future: mark as stale or delete
        expired++;
      }
    }

    // Refresh high-priority interests (last interaction < 7 days ago)
    const cutoffInteractionDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeInterests = await base44.asServiceRole.entities.ClientProjectInterest.list('-lastInteractionAt', 100);

    for (const interest of (activeInterests || []).slice(0, 50)) {
      if (interest.lastInteractionAt && new Date(interest.lastInteractionAt) > cutoffInteractionDate) {
        // Refresh reservation probability score
        const activities = await base44.asServiceRole.entities.Activity.filter({
          clientId: interest.clientId,
          projectId: interest.projectId
        });

        const units = await base44.asServiceRole.entities.SaleUnit.filter({
          projectId: interest.projectId,
          internalStatus: 'available'
        });

        const scoreData = await scoreReservationProbability(interest, activities, units);

        // Delete old score for this interest type
        const oldScores = await base44.asServiceRole.entities.LeadScore.filter({
          interestId: interest.id,
          scoreType: 'reservation_probability'
        });

        for (const oldScore of (oldScores || [])) {
          // Note: in production, would soft-delete or archive
          // For now, just create new version
        }

        const newScore = await base44.asServiceRole.entities.LeadScore.create({
          projectId: interest.projectId,
          clientId: interest.clientId,
          interestId: interest.id,
          scoreType: 'reservation_probability',
          scoreValue: scoreData.scoreValue,
          band: scoreData.band,
          reasonsJson: scoreData.reasonsJson,
          recommendationText: scoreData.recommendationText,
          recommendedAction: scoreData.recommendedAction,
          sourceDataSnapshotJson: JSON.stringify({
            stage: interest.pipelineStage,
            lastInteraction: interest.lastInteractionAt
          }),
          modelVersion: 'v1.0',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

        refreshed++;
      }
    }

    return Response.json({
      success: true,
      scoresExpired: expired,
      scoresRefreshed: refreshed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});