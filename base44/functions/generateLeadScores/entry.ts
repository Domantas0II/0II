import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => {
  const map = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
  return map[r] || r;
};

// Scoring functions (inlined to avoid import issues in Deno)
async function scoreInquiryPriority(inquiry) {
  const now = new Date();
  const createdDate = new Date(inquiry.created_date);
  const ageHours = (now - createdDate) / (1000 * 60 * 60);
  
  let score = 50;
  const reasons = [];

  if (ageHours < 2) {
    score += 25;
    reasons.push({ factor: 'inquiry_freshness', weight: 25, explanation: 'Inquiry sugeneruota per paskutines 2 valandas' });
  } else if (ageHours < 24) {
    score += 15;
    reasons.push({ factor: 'inquiry_freshness', weight: 15, explanation: 'Inquiry sugeneruota šiandien' });
  } else {
    score -= 10;
    reasons.push({ factor: 'inquiry_age', weight: -10, explanation: 'Inquiry gera jei senesne nei 24h' });
  }

  if (inquiry.status === 'new') {
    score += 20;
    reasons.push({ factor: 'unclaimed_inquiry', weight: 20, explanation: 'Inquiry dar nepriskirtai (new status)' });
  }

  if (inquiry.message && inquiry.message.length > 10) {
    score += 10;
    reasons.push({ factor: 'inquiry_has_message', weight: 10, explanation: 'Inquiry turi detalią žinutę' });
  }

  const band = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: band === 'critical' ? 'Imedatinis pristatymas' : band === 'high' ? 'Prioritetinis kontaktas' : 'Reguliarinis follow-up',
    recommendedAction: band === 'critical' ? 'call_now' : 'send_followup'
  };
}

async function scoreClientPriority(client, interests, tasks, activities) {
  let score = 50;
  const reasons = [];

  const activeInterests = (interests || []).filter(i => 
    ['contacted', 'considering', 'follow_up', 'reserved'].includes(i.status)
  );
  score += activeInterests.length * 10;
  if (activeInterests.length > 0) {
    reasons.push({
      factor: 'active_interests',
      weight: activeInterests.length * 10,
      explanation: `${activeInterests.length} aktyvios susidominimo(s)`
    });
  }

  if (activities && activities.length > 0) {
    const latestActivity = activities[0];
    const activityDate = new Date(latestActivity.completedAt || latestActivity.scheduledAt);
    const ageHours = (new Date() - activityDate) / (1000 * 60 * 60);
    
    if (ageHours < 24) {
      score += 15;
      reasons.push({ factor: 'recent_activity', weight: 15, explanation: 'Šiandien buvo kontaktas' });
    } else if (ageHours < 7 * 24) {
      score += 8;
      reasons.push({ factor: 'recent_activity', weight: 8, explanation: 'Per paskutines 7 dienas buvo kontaktas' });
    }
  } else {
    score -= 15;
    reasons.push({ factor: 'no_activity', weight: -15, explanation: 'Nėra jokios veiklos su klientu' });
  }

  const overdueTasks = (tasks || []).filter(t => t.status === 'overdue');
  if (overdueTasks.length > 0) {
    score += overdueTasks.length * 20;
    reasons.push({
      factor: 'overdue_tasks',
      weight: overdueTasks.length * 20,
      explanation: `${overdueTasks.length} vėluojanti(os) užduoti(s)`
    });
  }

  const band = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: band === 'critical' ? 'Eskalinti vadovui' : 'Tęsti aktyvų pristatymus',
    recommendedAction: band === 'critical' ? 'escalate_to_manager' : 'send_followup'
  };
}

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, clientId, inquiryId, interestId } = await req.json();
    const role = normalizeRole(user.role);

    // Access control: only admin/manager
    if (role !== 'ADMINISTRATOR' && role !== 'SALES_MANAGER') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If manager, verify project access
    if (role === 'SALES_MANAGER' && projectId) {
      const access = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId,
        removedAt: null
      });
      if (!access || access.length === 0) {
        return Response.json({ error: 'Access denied to project' }, { status: 403 });
      }
    }

    const scores = [];

    // Score inquiry if provided
    if (inquiryId) {
      const inquiries = await base44.entities.ProjectInquiry.filter({ id: inquiryId });
      if (inquiries && inquiries.length > 0) {
        const inquiry = inquiries[0];
        const scoreData = await scoreInquiryPriority(inquiry);
        
        const leadscore = await base44.entities.LeadScore.create({
          projectId: inquiry.projectId,
          inquiryId: inquiry.id,
          scoreType: 'inquiry_priority',
          scoreValue: scoreData.scoreValue,
          band: scoreData.band,
          reasonsJson: scoreData.reasonsJson,
          recommendationText: scoreData.recommendationText,
          recommendedAction: scoreData.recommendedAction,
          sourceDataSnapshotJson: JSON.stringify({ inquiryStatus: inquiry.status }),
          modelVersion: 'v1.0',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        scores.push(leadscore);
      }
    }

    // Score client if provided
    if (clientId) {
      const clients = await base44.entities.Client.filter({ id: clientId });
      if (clients && clients.length > 0) {
        const client = clients[0];
        
        // Fetch interests, tasks, activities for this client
        const interests = await base44.entities.ClientProjectInterest.filter({
          clientId,
          projectId: projectId || undefined
        });
        const tasks = await base44.entities.Task.filter({ clientId });
        const activities = await base44.entities.Activity.filter({ clientId });

        const scoreData = await scoreClientPriority(client, interests, tasks, activities);
        
        const leadscore = await base44.entities.LeadScore.create({
          projectId,
          clientId: client.id,
          scoreType: 'client_priority',
          scoreValue: scoreData.scoreValue,
          band: scoreData.band,
          reasonsJson: scoreData.reasonsJson,
          recommendationText: scoreData.recommendationText,
          recommendedAction: scoreData.recommendedAction,
          sourceDataSnapshotJson: JSON.stringify({
            interestCount: interests?.length || 0,
            taskCount: tasks?.length || 0,
            activityCount: activities?.length || 0
          }),
          modelVersion: 'v1.0',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        scores.push(leadscore);
      }
    }

    // Score reservation/interest if provided
    if (interestId) {
      const interests = await base44.entities.ClientProjectInterest.filter({ id: interestId });
      if (interests && interests.length > 0) {
        const interest = interests[0];

        // Fetch activities
        const activities = await base44.entities.Activity.filter({
          clientId: interest.clientId,
          projectId: interest.projectId
        });

        // Fetch available units (for reservation probability)
        const units = await base44.entities.SaleUnit.filter({
          projectId: interest.projectId,
          internalStatus: 'available'
        });

        const scoreData = await scoreReservationProbability(interest, activities, units);
        
        const leadscore = await base44.entities.LeadScore.create({
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
            status: interest.status
          }),
          modelVersion: 'v1.0',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        scores.push(leadscore);
      }
    }

    return Response.json({
      success: true,
      scoresGenerated: scores.length,
      scores
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});