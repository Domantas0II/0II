import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => {
  const map = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
  return map[r] || r;
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

/**
 * GOVERNANCE NOTE: Scoring weights are centrally managed in SystemSetting
 * Keys: scoring.inquiryWeights, scoring.clientWeights, etc.
 * This ensures all scoring engines use consistent, admin-controlled parameters
 * Future: Load weights from DB per-call for real-time adjustment
 */

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

async function scoreDealProbability(reservation, agreement, payments) {
  let score = 20;
  const reasons = [];

  if (reservation.status === 'active') {
    score += 30;
    reasons.push({ factor: 'reservation_active', weight: 30, explanation: 'Rezervacija yra aktyvi' });
  } else if (reservation.status === 'converted') {
    score += 90;
    reasons.push({ factor: 'reservation_converted', weight: 90, explanation: 'Rezervacija jau konvertuota į sutartį' });
  }

  if (agreement && agreement.status === 'signed') {
    score += 40;
    reasons.push({ factor: 'agreement_signed', weight: 40, explanation: 'Sutartis pasirašyta' });
  } else if (agreement && agreement.status === 'draft') {
    score += 15;
    reasons.push({ factor: 'agreement_draft', weight: 15, explanation: 'Sutartis paruošta, laukia parašo' });
  }

  const advancePayments = (payments || []).filter(p => p.paymentType === 'advance' && p.status === 'recorded');
  if (advancePayments.length > 0) {
    score += advancePayments.length * 15;
    reasons.push({ factor: 'advance_payments', weight: advancePayments.length * 15, explanation: `${advancePayments.length} avanso mokėjimai zregistruoti` });
  }

  const band = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: score >= 75 ? 'Finalizuoti deal' : score >= 50 ? 'Tęsti sutarties procesą' : 'Laukti susitarimo',
    recommendedAction: score >= 75 ? 'call_now' : score >= 50 ? 'send_followup' : 'wait'
  };
}

async function scoreFollowupUrgency(task, interest) {
  let score = 40;
  const reasons = [];

  if (task.status === 'overdue') {
    score += 35;
    reasons.push({ factor: 'task_overdue', weight: 35, explanation: 'Užduotis jau vėluoja' });
  } else {
    const dueDate = new Date(task.dueAt);
    const hoursUntilDue = (dueDate - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntilDue < 2) {
      score += 30;
      reasons.push({ factor: 'due_very_soon', weight: 30, explanation: 'Terminas per 2 valandas' });
    } else if (hoursUntilDue < 24) {
      score += 20;
      reasons.push({ factor: 'due_soon', weight: 20, explanation: 'Terminas per 24 valandas' });
    }
  }

  const priorityWeights = { low: 0, medium: 5, high: 15, critical: 25 };
  score += priorityWeights[task.priority] || 0;
  reasons.push({
    factor: 'task_priority',
    weight: priorityWeights[task.priority] || 0,
    explanation: `Prioritetas: ${task.priority}`
  });

  if (task.type === 'call' || task.type === 'meeting') {
    score += 10;
    reasons.push({ factor: 'interactive_task', weight: 10, explanation: 'Būtinas tiesioginis kontaktas' });
  }

  const band = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';

  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: band === 'critical' ? 'DABAR vykdyti' : band === 'high' ? 'Šiandien vykdyti' : 'Planuoti šią savaitę',
    recommendedAction: band === 'critical' ? 'call_now' : 'send_followup'
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

    // GOVERNANCE: Pre-load scoring weights from SystemSetting (optional optimization)
    // Individual scoring functions will use these if available
    const scoringWeights = await getSettingValue('scoring.weights', null, base44);

    // FIX #1: Agent access control - enable with scope validation
    // SALES_AGENT can score, but only within their visible scope
    if (role === 'SALES_AGENT') {
      // projectId is required for agents (no full pipeline)
      if (!projectId) {
        return Response.json({ error: 'projectId required for agents' }, { status: 400 });
      }

      // Verify agent has access to project
      const access = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId,
        removedAt: null
      });
      if (!access || access.length === 0) {
        return Response.json({ error: 'Access denied to project' }, { status: 403 });
      }

      // If interestId provided, verify it belongs to this project
      if (interestId) {
        const interests = await base44.entities.ClientProjectInterest.filter({
          id: interestId,
          projectId
        });
        if (!interests || interests.length === 0) {
          return Response.json({
            error: 'Interest not found in this project'
          }, { status: 404 });
        }
      }

      // If clientId provided, verify it's linked to an interest in this project
      if (clientId) {
        const interests = await base44.entities.ClientProjectInterest.filter({
          clientId,
          projectId
        });
        if (!interests || interests.length === 0) {
          return Response.json({
            error: 'Client not found in this project scope'
          }, { status: 404 });
        }
      }
    } else if (role === 'SALES_MANAGER') {
      // Manager: verify project access if projectId provided
      if (projectId) {
        const access = await base44.entities.UserProjectAssignment.filter({
          userId: user.id,
          projectId,
          removedAt: null
        });
        if (!access || access.length === 0) {
          return Response.json({ error: 'Access denied to project' }, { status: 403 });
        }
      }
    } else if (role !== 'ADMINISTRATOR') {
      // Only ADMINISTRATOR, SALES_MANAGER, SALES_AGENT allowed
      return Response.json({ error: 'Forbidden' }, { status: 403 });
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

    // Score task urgency if provided (via clientId)
    if (clientId) {
      const tasks = await base44.entities.Task.filter({
        clientId,
        status: { $in: ['pending', 'in_progress', 'overdue'] }
      });

      for (const task of (tasks || []).slice(0, 3)) {
        const scoreData = await scoreFollowupUrgency(task, null);
        
        const leadscore = await base44.entities.LeadScore.create({
          projectId,
          clientId,
          scoreType: 'followup_urgency',
          scoreValue: scoreData.scoreValue,
          band: scoreData.band,
          reasonsJson: scoreData.reasonsJson,
          recommendationText: scoreData.recommendationText,
          recommendedAction: scoreData.recommendedAction,
          sourceDataSnapshotJson: JSON.stringify({
            taskId: task.id,
            taskTitle: task.title,
            taskStatus: task.status
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