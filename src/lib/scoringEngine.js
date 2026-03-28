/**
 * Deterministic Scoring Engine for Lead/Interest/Deal Prioritization
 * All scores are calculated from explicit weighted factors with explanations
 */

export async function scoreInquiryPriority(inquiry, base44) {
  const now = new Date();
  const createdDate = new Date(inquiry.created_date);
  const ageHours = (now - createdDate) / (1000 * 60 * 60);
  
  let score = 50;
  const reasons = [];

  // Factor 1: Age (newer = higher urgency)
  if (ageHours < 2) {
    score += 25;
    reasons.push({
      factor: 'inquiry_freshness',
      weight: 25,
      explanation: 'Inquiry sugeneruota per paskutines 2 valandas'
    });
  } else if (ageHours < 24) {
    score += 15;
    reasons.push({
      factor: 'inquiry_freshness',
      weight: 15,
      explanation: 'Inquiry sugeneruota šiandien'
    });
  } else {
    score -= 10;
    reasons.push({
      factor: 'inquiry_age',
      weight: -10,
      explanation: 'Inquiry gera jei senesne nei 24h'
    });
  }

  // Factor 2: Status (new > claimed)
  if (inquiry.status === 'new') {
    score += 20;
    reasons.push({
      factor: 'unclaimed_inquiry',
      weight: 20,
      explanation: 'Inquiry dar nepriskirtai (new status)'
    });
  } else if (inquiry.status === 'claimed') {
    score += 0;
    reasons.push({
      factor: 'claimed_inquiry',
      weight: 0,
      explanation: 'Inquiry jau priskirtai'
    });
  }

  // Factor 3: Has message / info
  if (inquiry.message && inquiry.message.length > 10) {
    score += 10;
    reasons.push({
      factor: 'inquiry_has_message',
      weight: 10,
      explanation: 'Inquiry turi detalią žinutę'
    });
  }

  // Factor 4: Has phone number
  if (inquiry.phone && inquiry.phone.length > 0) {
    score += 5;
    reasons.push({
      factor: 'contact_available',
      weight: 5,
      explanation: 'Telefono numeris nurodytus'
    });
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

export async function scoreClientPriority(client, interests, tasks, activities, base44) {
  let score = 50;
  const reasons = [];

  // Factor 1: Active interests count
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

  // Factor 2: Recent activity
  if (activities && activities.length > 0) {
    const latestActivity = activities[0];
    const activityDate = new Date(latestActivity.completedAt || latestActivity.scheduledAt);
    const ageHours = (new Date() - activityDate) / (1000 * 60 * 60);
    
    if (ageHours < 24) {
      score += 15;
      reasons.push({
        factor: 'recent_activity',
        weight: 15,
        explanation: 'Šiandien buvo kontaktas'
      });
    } else if (ageHours < 7 * 24) {
      score += 8;
      reasons.push({
        factor: 'recent_activity',
        weight: 8,
        explanation: 'Per paskutines 7 dienas buvo kontaktas'
      });
    }
  } else {
    score -= 15;
    reasons.push({
      factor: 'no_activity',
      weight: -15,
      explanation: 'Nėra jokios veiklos su klientu'
    });
  }

  // Factor 3: Overdue tasks
  const overdueTasks = (tasks || []).filter(t => t.status === 'overdue');
  if (overdueTasks.length > 0) {
    score += overdueTasks.length * 20;
    reasons.push({
      factor: 'overdue_tasks',
      weight: overdueTasks.length * 20,
      explanation: `${overdueTasks.length} vėluojanti(os) užduoti(s)`
    });
  }

  // Factor 4: Won interest
  const wonInterests = (interests || []).filter(i => i.status === 'won');
  if (wonInterests.length > 0) {
    score += 25;
    reasons.push({
      factor: 'interest_won',
      weight: 25,
      explanation: 'Vienas susidomėjimas jau won'
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

export async function scoreReservationProbability(interest, activities, units, base44) {
  let score = 40;
  const reasons = [];

  // Factor 1: Interest stage
  const stageWeights = {
    new: 5,
    contacted: 10,
    consultation: 15,
    visit: 25,
    negotiation: 40,
    reserved: 80,
    won: 95
  };
  const stageWeight = stageWeights[interest.pipelineStage] || 5;
  score += stageWeight;
  reasons.push({
    factor: 'pipeline_stage',
    weight: stageWeight,
    explanation: `Pipeline stadija: ${interest.pipelineStage}`
  });

  // Factor 2: Recent interaction
  if (interest.lastInteractionAt) {
    const interactionDate = new Date(interest.lastInteractionAt);
    const ageHours = (new Date() - interactionDate) / (1000 * 60 * 60);
    
    if (ageHours < 24) {
      score += 15;
      reasons.push({
        factor: 'recent_interaction',
        weight: 15,
        explanation: 'Kontaktas per paskutines 24h'
      });
    } else if (ageHours > 7 * 24) {
      score -= 15;
      reasons.push({
        factor: 'stale_interest',
        weight: -15,
        explanation: 'Kontaktas buvo daugiau nei 7 dienos atgal'
      });
    }
  }

  // Factor 3: Upcoming follow-up
  if (interest.nextFollowUpAt) {
    const followUpDate = new Date(interest.nextFollowUpAt);
    const hoursUntilFollowUp = (followUpDate - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntilFollowUp > 0 && hoursUntilFollowUp < 24) {
      score += 10;
      reasons.push({
        factor: 'followup_soon',
        weight: 10,
        explanation: 'Follow-up suplanuota artimoje ateityje'
      });
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

export async function scoreDealProbability(reservation, agreement, payments, activities, base44) {
  let score = 20;
  const reasons = [];

  // Factor 1: Reservation status
  if (reservation.status === 'active') {
    score += 30;
    reasons.push({
      factor: 'reservation_active',
      weight: 30,
      explanation: 'Rezervacija yra aktyvi'
    });
  } else if (reservation.status === 'converted') {
    score += 90;
    reasons.push({
      factor: 'reservation_converted',
      weight: 90,
      explanation: 'Rezervacija jau konvertuota į sutartį'
    });
  }

  // Factor 2: Agreement signed
  if (agreement && agreement.status === 'signed') {
    score += 40;
    reasons.push({
      factor: 'agreement_signed',
      weight: 40,
      explanation: 'Sutartis pasirašyta'
    });
  } else if (agreement && agreement.status === 'draft') {
    score += 15;
    reasons.push({
      factor: 'agreement_draft',
      weight: 15,
      explanation: 'Sutartis paruošta, laukia parašo'
    });
  }

  // Factor 3: Payments recorded
  const advancePayments = (payments || []).filter(p => p.paymentType === 'advance' && p.status === 'recorded');
  if (advancePayments.length > 0) {
    score += advancePayments.length * 15;
    reasons.push({
      factor: 'advance_payments',
      weight: advancePayments.length * 15,
      explanation: `${advancePayments.length} avanso mokėjimai zregistruoti`
    });
  }

  // Factor 4: Days in pipeline
  if (reservation.reservedAt) {
    const reservationDate = new Date(reservation.reservedAt);
    const daysSinceReservation = (new Date() - reservationDate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceReservation > 30) {
      score += 10;
      reasons.push({
        factor: 'long_engagement',
        weight: 10,
        explanation: 'Klientas su mumis ilgiau nei 30 dienų'
      });
    }
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

export async function scoreFollowupUrgency(task, interest, slaConfig) {
  let score = 40;
  const reasons = [];

  // Factor 1: Task overdue
  if (task.status === 'overdue') {
    score += 35;
    reasons.push({
      factor: 'task_overdue',
      weight: 35,
      explanation: 'Užduotis jau vėluoja'
    });
  } else {
    const dueDate = new Date(task.dueAt);
    const hoursUntilDue = (dueDate - new Date()) / (1000 * 60 * 60);
    
    if (hoursUntilDue < 2) {
      score += 30;
      reasons.push({
        factor: 'due_very_soon',
        weight: 30,
        explanation: 'Terminas per 2 valandas'
      });
    } else if (hoursUntilDue < 24) {
      score += 20;
      reasons.push({
        factor: 'due_soon',
        weight: 20,
        explanation: 'Terminas per 24 valandas'
      });
    }
  }

  // Factor 2: Task priority
  const priorityWeights = { low: 0, medium: 5, high: 15, critical: 25 };
  score += priorityWeights[task.priority] || 0;
  reasons.push({
    factor: 'task_priority',
    weight: priorityWeights[task.priority] || 0,
    explanation: `Prioritetas: ${task.priority}`
  });

  // Factor 3: Task type
  if (task.type === 'call' || task.type === 'meeting') {
    score += 10;
    reasons.push({
      factor: 'interactive_task',
      weight: 10,
      explanation: 'Būtinas tiesioginis kontaktas'
    });
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

export async function scoreUnitMatch(clientInterest, availableUnits, project) {
  const results = [];

  for (const unit of availableUnits) {
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

    // Factor 2: Status available
    if (unit.internalStatus === 'available') {
      score += 20;
      reasons.push({
        factor: 'unit_available',
        weight: 20,
        explanation: 'Unit yra laisvai parduodamas'
      });
    } else {
      score -= 40;
      reasons.push({
        factor: 'unit_not_available',
        weight: -40,
        explanation: 'Unit nėra laisvai'
      });
      results.push({
        unitId: unit.id,
        matchScore: 0,
        matchReasonsJson: JSON.stringify(reasons)
      });
      continue;
    }

    // Factor 3: Type preference (if client viewed similar type)
    // Heuristic: assume type preference from existing interests or client browsing
    // For now, simple match on common features
    score += 5; // base for matching

    // Factor 4: Price range heuristic
    // If we know client's price sensitivity from previous interests
    // For now, generic scoring
    reasons.push({
      factor: 'price_range_match',
      weight: 5,
      explanation: 'Price range rekomenduojamas'
    });

    // Factor 5: Area match
    if (unit.areaM2 >= 30 && unit.areaM2 <= 200) {
      score += 5;
      reasons.push({
        factor: 'area_reasonable',
        weight: 5,
        explanation: `Plotas ${unit.areaM2}m² yra pagrindinis`
      });
    }

    // Factor 6: Public vs private
    if (unit.isPublic) {
      score += 3;
      reasons.push({
        factor: 'unit_public',
        weight: 3,
        explanation: 'Unit viešai rodomas'
      });
    }

    results.push({
      unitId: unit.id,
      matchScore: Math.min(100, score),
      matchReasonsJson: JSON.stringify(reasons)
    });
  }

  // Sort by score and return top 5
  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}