import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * FIX #5: Hourly cron function - Refresh lead scores
 * - Marks expired scores
 * - Recalculates for high-priority interests via real generateLeadScores
 * - Wired via scheduled automation (hourly)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all scores (last 24h)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentScores = await base44.asServiceRole.entities.LeadScore.filter({
      generatedAt: { $gte: cutoffDate.toISOString() }
    });

    let expired = 0;
    let refreshed = 0;

    // Mark expired scores
    for (const score of (recentScores || []).slice(0, 200)) {
      if (score.expiresAt && new Date(score.expiresAt) < new Date()) {
        expired++;
      }
    }

    // FIX #4: Expired state handling - mark as metric for now, document clearly
    // Expired scores are tracked but not invalidated in this phase
    // Future: implement soft-delete or archival mechanism
    // Current: expired count is observability metric only

    // Refresh high-priority interests (last interaction < 7 days)
    const cutoffInteractionDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeInterests = await base44.asServiceRole.entities.ClientProjectInterest.list('-lastInteractionAt', 100);

    for (const interest of (activeInterests || []).slice(0, 50)) {
      if (interest.lastInteractionAt && new Date(interest.lastInteractionAt) > cutoffInteractionDate) {
        // FIX #3: Reliable result parsing
        // generateLeadScores returns: { success, scoresGenerated, scores }
        const result = await base44.asServiceRole.functions.invoke('generateLeadScores', {
          projectId: interest.projectId,
          clientId: interest.clientId,
          interestId: interest.id
        });

        // Parse response shape correctly
        if (result?.data?.success && typeof result.data.scoresGenerated === 'number') {
          refreshed += result.data.scoresGenerated;
        }
      }
    }

    return Response.json({
      success: true,
      scoresExpired: expired,
      scoresRefreshed: refreshed,
      timestamp: new Date().toISOString(),
      note: 'Expired scores tracked; invalidation pending future implementation'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});