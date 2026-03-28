export const PIPELINE_STAGES = ['new', 'contacted', 'consultation', 'visit', 'negotiation', 'reserved', 'won', 'lost'];

export const PIPELINE_STAGE_LABELS = {
  new: 'Naujas',
  contacted: 'Susisiekta',
  consultation: 'Konsultacija',
  visit: 'Apsilankymas',
  negotiation: 'Derybos',
  reserved: 'Rezervuota',
  won: 'Nugalėta',
  lost: 'Prarasta',
};

export const ACTIVITY_TYPE_LABELS = {
  call: 'Skambutis',
  sms: 'SMS',
  email: 'El. paštas',
  consultation: 'Konsultacija',
  visit: 'Apsilankymas',
  other: 'Kita',
};

export const ACTIVITY_STATUS_LABELS = {
  planned: 'Suplanuota',
  done: 'Baigta',
  cancelled: 'Atšaukta',
};

export const ACTIVITY_TYPE_ICONS = {
  call: '📞',
  sms: '💬',
  email: '📧',
  consultation: '👥',
  visit: '🏠',
  other: '📝',
};

export const STAGE_COLORS = {
  new: 'bg-blue-50',
  contacted: 'bg-cyan-50',
  consultation: 'bg-amber-50',
  visit: 'bg-purple-50',
  negotiation: 'bg-orange-50',
  reserved: 'bg-yellow-50',
  won: 'bg-green-50',
  lost: 'bg-red-50',
};

export const STAGE_BORDER_COLORS = {
  new: 'border-blue-200',
  contacted: 'border-cyan-200',
  consultation: 'border-amber-200',
  visit: 'border-purple-200',
  negotiation: 'border-orange-200',
  reserved: 'border-yellow-200',
  won: 'border-green-200',
  lost: 'border-red-200',
};