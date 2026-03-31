/**
 * ═══════════════════════════════════════════════════════════════
 * PIPELINE SOURCE-OF-TRUTH
 * ═══════════════════════════════════════════════════════════════
 * OFFICIAL STAGES (active logic):
 *   new_contact | no_answer_1 | no_answer_2 | no_answer_3
 *   proposal_sent | not_relevant | consultation_booked
 *   viewing_booked | waiting_response | follow_up | negotiation | reservation
 *
 * LEGACY BRIDGE (display only, backward compat via normalizePipelineStage):
 *   new → new_contact | contacted → no_answer_1
 *   consultation → consultation_booked | visit → viewing_booked
 *   reserved / won → reservation | lost → not_relevant
 *
 * DO NOT use legacy keys in active business logic.
 * ═══════════════════════════════════════════════════════════════
 */
export const PIPELINE_STAGES = [
  'new_contact',
  'no_answer_1',
  'no_answer_2',
  'no_answer_3',
  'proposal_sent',
  'not_relevant',
  'consultation_booked',
  'viewing_booked',
  'waiting_response',
  'follow_up',
  'negotiation',
  'reservation',
];

export const PIPELINE_STAGE_LABELS = {
  new_contact:          'Naujas kontaktas',
  no_answer_1:          'Nekelia',
  no_answer_2:          'Nekelia x2',
  no_answer_3:          'Nekelia x3',
  proposal_sent:        'Išsiųstas pasiūlymas',
  not_relevant:         'Neaktualu',
  consultation_booked:  'Sutarta konsultacija',
  viewing_booked:       'Sutarta apžiūra',
  waiting_response:     'Laukiama atsakymo',
  follow_up:            'Follow up',
  negotiation:          'Derybos',
  reservation:          'Rezervacija',
  // legacy fallbacks (for old data)
  new:          'Naujas kontaktas',
  contacted:    'Nekelia',
  consultation: 'Sutarta konsultacija',
  visit:        'Sutarta apžiūra',
  negotiation_old: 'Derybos',
  reserved:     'Rezervacija',
  won:          'Rezervacija',
  lost:         'Neaktualu',
};

// Stage thresholds (days) — centralized, easy to change
export const STAGE_OVERDUE_THRESHOLD_DAYS = {
  new_contact:         1,
  no_answer_1:         2,
  no_answer_2:         3,
  no_answer_3:         5,
  proposal_sent:       5,
  not_relevant:        30,
  consultation_booked: 3,
  viewing_booked:      3,
  waiting_response:    3,
  follow_up:           3,
  negotiation:         7,
  reservation:         14,
};

export const STAGE_COLORS = {
  new_contact:          'bg-blue-50',
  no_answer_1:          'bg-slate-50',
  no_answer_2:          'bg-slate-100',
  no_answer_3:          'bg-orange-50',
  proposal_sent:        'bg-cyan-50',
  not_relevant:         'bg-red-50',
  consultation_booked:  'bg-amber-50',
  viewing_booked:       'bg-purple-50',
  waiting_response:     'bg-yellow-50',
  follow_up:            'bg-indigo-50',
  negotiation:          'bg-orange-50',
  reservation:          'bg-green-50',
};

export const STAGE_BORDER_COLORS = {
  new_contact:          'border-blue-200',
  no_answer_1:          'border-slate-200',
  no_answer_2:          'border-slate-300',
  no_answer_3:          'border-orange-200',
  proposal_sent:        'border-cyan-200',
  not_relevant:         'border-red-200',
  consultation_booked:  'border-amber-200',
  viewing_booked:       'border-purple-200',
  waiting_response:     'border-yellow-300',
  follow_up:            'border-indigo-200',
  negotiation:          'border-orange-300',
  reservation:          'border-green-300',
};

export const ACTIVITY_TYPE_LABELS = {
  call:         'Skambutis',
  sms:          'SMS',
  email:        'El. paštas',
  consultation: 'Konsultacija',
  visit:        'Apsilankymas',
  other:        'Kita',
};

export const ACTIVITY_STATUS_LABELS = {
  planned:   'Suplanuota',
  done:      'Baigta',
  cancelled: 'Atšaukta',
};

export const ACTIVITY_TYPE_ICONS = {
  call:         '📞',
  sms:          '💬',
  email:        '📧',
  consultation: '👥',
  visit:        '🏠',
  other:        '📝',
};

// Stages where last call time is shown on the pipeline card (early / no-answer stages only)
export const CALL_TIME_VISIBLE_STAGES = new Set([
  'new_contact',
  'no_answer_1',
  'no_answer_2',
  'no_answer_3',
]);

// Normalize legacy stage keys to new ones
export function normalizePipelineStage(stage) {
  const map = {
    new:          'new_contact',
    contacted:    'no_answer_1',
    consultation: 'consultation_booked',
    visit:        'viewing_booked',
    reserved:     'reservation',
    won:          'reservation',
    lost:         'not_relevant',
  };
  return map[stage] || stage;
}