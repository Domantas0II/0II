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

// DEFAULT scoring weights (used as fallback if SystemSetting not found)
const DEFAULT_WEIGHTS = {
  inquiry: {
    freshness_hot: 25,    // < 2h
    freshness_warm: 15,   // < 24h
    freshness_cold: -10,  // > 24h
    unclaimed: 20,
    has_message: 10
  },
  client: {
    per_active_interest: 10,
    recent_activity_today: 15,
    recent_activity_week: 8,
    no_activity: -15,
    per_overdue_task: 20
  },
  reservation: {
    recent_interaction: 15,
    stale_interaction: -15,
    stage: { new: 5, contacted: 10, consultation: 15, visit: 25, negotiation: 40, reserved: 80, won: 95 }
  },
  deal: {
    reservation_active: 30,
    reservation_converted: 90,
    agreement_signed: 40,
    agreement_draft: 15,
    per_advance_payment: 15
  },
  followup: {
    task_overdue: 35,
    due_very_soon: 30,   // < 2h
    due_soon: 20,         // < 24h
    interactive_task: 10,
    priority: { low: 0, medium: 5, high: 15, critical: 25 }
  }
};

function toBand(score) {
  return score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
}

// Scoring functions accept weights param — falls back to DEFAULT_WEIGHTS if not provided
function scoreInquiryPriority(inquiry, weights) {
  const w = { ...DEFAULT_WEIGHTS.inquiry, ...(weights?.inquiry || {}) };
  const now = new Date();
  const ageHours = (now - new Date(inquiry.created_date)) / (1000 * 60 * 60);

  let score = 50;
  const reasons = [];

  if (ageHours < 2) {
    score += w.freshness_hot;
    reasons.push({ factor: 'inquiry_freshness', weight: w.freshness_hot, explanation: 'Inquiry sugeneruota per paskutines 2 valandas' });
  } else if (ageHours < 24) {
    score += w.freshness_warm;
    reasons.push({ factor: 'inquiry_freshness', weight: w.freshness_warm, explanation: 'Inquiry sugeneruota šiandien' });
  } else {
    score += w.freshness_cold;
    reasons.push({ factor: 'inquiry_age', weight: w.freshness_cold, explanation: 'Inquiry senesnė nei 24h' });
  }

  if (inquiry.status === 'new') {
    score += w.unclaimed;
    reasons.push({ factor: 'unclaimed_inquiry', weight: w.unclaimed, explanation: 'Inquiry dar nepriskirtai (new status)' });
  }

  if (inquiry.message && inquiry.message.length > 10) {
    score += w.has_message;
    reasons.push({ factor: 'inquiry_has_message', weight: w.has_message, explanation: 'Inquiry turi detalią žinutę' });
  }

  const band = toBand(score);
  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: band === 'critical' ? 'Imedatinis pristatymas' : band === 'high' ? 'Prioritetinis kontaktas' : 'Reguliarinis follow-up',
    recommendedAction: band === 'critical' ? 'call_now' : 'send_followup'
  };
}

function scoreClientPriority(client, interests, tasks, activities, weights) {
  const w = { ...DEFAULT_WEIGHTS.client, ...(weights?.client || {}) };
  let score = 50;
  const reasons = [];

  const activeInterests = (interests || []).filter(i =>
    ['contacted', 'considering', 'follow_up', 'reserved'].includes(i.status)
  );
  if (activeInterests.length > 0) {
    const pts = activeInterests.length * w.per_active_interest;
    score += pts;
    reasons.push({ factor: 'active_interests', weight: pts, explanation: `${activeInterests.length} aktyvios susidominimo(s)` });
  }

  if (activities && activities.length > 0) {
    const ageHours = (new Date() - new Date(activities[0].completedAt || activities[0].scheduledAt)) / (1000 * 60 * 60);
    if (ageHours < 24) {
      score += w.recent_activity_today;
      reasons.push({ factor: 'recent_activity', weight: w.recent_activity_today, explanation: 'Šiandien buvo kontaktas' });
    } else if (ageHours < 7 * 24) {
      score += w.recent_activity_week;
      reasons.push({ factor: 'recent_activity', weight: w.recent_activity_week, explanation: 'Per paskutines 7 dienas buvo kontaktas' });
    }
  } else {
    score += w.no_activity;
    reasons.push({ factor: 'no_activity', weight: w.no_activity, explanation: 'Nėra jokios veiklos su klientu' });
  }

  const overdueTasks = (tasks || []).filter(t => t.status === 'overdue');
  if (overdueTasks.length > 0) {
    const pts = overdueTasks.length * w.per_overdue_task;
    score += pts;
    reasons.push({ factor: 'overdue_tasks', weight: pts, explanation: `${overdueTasks.length} vėluojanti(os) užduoti(s)` });
  }

  const band = toBand(score);
  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: band === 'critical' ? 'Eskalinti vadovui' : 'Tęsti aktyvų pristatymus',
    recommendedAction: band === 'critical' ? 'escalate_to_manager' : 'send_followup'
  };
}

function scoreReservationProbability(interest, activities, units, weights) {
  const w = { ...DEFAULT_WEIGHTS.reservation, ...(weights?.reservation || {}) };
  const stageWeights = { ...DEFAULT_WEIGHTS.reservation.stage, ...(weights?.reservation?.stage || {}) };
  let score = 40;
  const reasons = [];

  const stageWeight = stageWeights[interest.pipelineStage] || 5;
  score += stageWeight;
  reasons.push({ factor: 'pipeline_stage', weight: stageWeight, explanation: `Pipeline stadija: ${interest.pipelineStage}` });

  if (interest.lastInteractionAt) {
    const ageHours = (new Date() - new Date(interest.lastInteractionAt)) / (1000 * 60 * 60);
    if (ageHours < 24) {
      score += w.recent_interaction;
      reasons.push({ factor: 'recent_interaction', weight: w.recent_interaction, explanation: 'Kontaktas per paskutines 24h' });
    } else if (ageHours > 7 * 24) {
      score += w.stale_interaction;
      reasons.push({ factor: 'stale_interest', weight: w.stale_interaction, explanation: 'Kontaktas buvo daugiau nei 7 dienos atgal' });
    }
  }

  const band = toBand(score);
  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: score >= 70 ? 'Aktyviai bendrauti, siūlyti rezervaciją' : 'Tęsti nurodytas veiklas',
    recommendedAction: score >= 70 ? 'propose_units' : 'send_followup'
  };
}

function scoreDealProbability(reservation, agreement, payments, weights) {
  const w = { ...DEFAULT_WEIGHTS.deal, ...(weights?.deal || {}) };
  let score = 20;
  const reasons = [];

  if (reservation.status === 'active') {
    score += w.reservation_active;
    reasons.push({ factor: 'reservation_active', weight: w.reservation_active, explanation: 'Rezervacija yra aktyvi' });
  } else if (reservation.status === 'converted') {
    score += w.reservation_converted;
    reasons.push({ factor: 'reservation_converted', weight: w.reservation_converted, explanation: 'Rezervacija jau konvertuota į sutartį' });
  }

  if (agreement?.status === 'signed') {
    score += w.agreement_signed;
    reasons.push({ factor: 'agreement_signed', weight: w.agreement_signed, explanation: 'Sutartis pasirašyta' });
  } else if (agreement?.status === 'draft') {
    score += w.agreement_draft;
    reasons.push({ factor: 'agreement_draft', weight: w.agreement_draft, explanation: 'Sutartis paruošta, laukia parašo' });
  }

  const advancePayments = (payments || []).filter(p => p.paymentType === 'advance' && p.status === 'recorded');
  if (advancePayments.length > 0) {
    const pts = advancePayments.length * w.per_advance_payment;
    score += pts;
    reasons.push({ factor: 'advance_payments', weight: pts, explanation: `${advancePayments.length} avanso mokėjimai registruoti` });
  }

  const band = toBand(score);
  return {
    scoreValue: Math.min(100, score),
    band,
    reasonsJson: JSON.stringify(reasons),
    recommendationText: score >= 75 ? 'Finalizuoti deal' : score >= 50 ? 'Tęsti sutarties procesą' : 'Laukti susitarimo',
    recommendedAction: score >= 75 ? 'call_now' : score >= 50 ? 'send_followup' : 'wait'
  };
}

function scoreFollowupUrgency(task, interest, weights) {
  const w = { ...DEFAULT_WEIGHTS.followup, ...(weights?.followup || {}) };
  const priorityWeights = { ...DEFAULT_WEIGHTS.followup.priority, ...(weights?.followup?.priority || {}) };
  let score = 40;
  const reasons = [];

  if (task.status === 'overdue') {
    score += w.task_overdue;
    reasons.push({ factor: 'task_overdue', weight: w.task_overdue, explanation: 'Užduotis jau vėluoja' });
  } else {
    const hoursUntilDue = (new Date(task.dueAt) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilDue < 2) {
      score += w.due_very_soon;
      reasons.push({ factor: 'due_very_soon', weight: w.due_very_soon, explanation: 'Terminas per 2 valandas' });
    } else if (hoursUntilDue < 24) {
      score += w.due_soon;
      reasons.push({ factor: 'due_soon', weight: w.due_soon, explanation: 'Terminas per 24 valandas' });
    }
  }

  const pWeight = priorityWeights[task.priority] || 0;
  score += pWeight;
  reasons.push({ factor: 'task_priority', weight: pWeight, explanation: `Prioritetas: ${task.priority}` });

  if (task.type === 'call' || task.type === 'meeting') {
    score += w.interactive_task;
    reasons.push({ factor: 'interactive_task', weight: w.interactive_task, explanation: 'Būtinas tiesioginis kontaktas' });
  }

  const band = toBand(score);
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

    // GOVERNANCE: Load scoring weights from SystemSetting — all scoring functions use these
    const scoringWeights = await getSettingValue('scoring.weights', null, base44);
    // Falls back to DEFAULT_WEIGHTS inside each scoring function if null

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
        const scoreData = scoreInquiryPriority(inquiry, scoringWeights);
        
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

        const scoreData = scoreClientPriority(client, interests, tasks, activities, scoringWeights);
        
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

        const scoreData = scoreReservationProbability(interest, activities, units, scoringWeights);
        
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
        const scoreData = scoreFollowupUrgency(task, null, scoringWeights);
        
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