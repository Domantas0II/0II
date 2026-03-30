// ─── ROLES ────────────────────────────────────────────────────────────────────
// Vieninteliai leistini roles enum reikšmės sistemoje.
// NIEKADA nenaudoti: 'ADMIN', 'DEVELOPER'

export const ROLES = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  SALES_MANAGER: 'SALES_MANAGER',
  SALES_AGENT: 'SALES_AGENT',
  PROJECT_DEVELOPER: 'PROJECT_DEVELOPER',
};

// UI pavadinimai (tik lietuviškai – niekada nerodyti enum reikšmių)
export const ROLE_LABELS = {
  ADMINISTRATOR: 'Administratorius',
  SALES_MANAGER: 'Pardavimų vadovas',
  SALES_AGENT: 'Pardavimų vadybininkas',
  PROJECT_DEVELOPER: 'Vystytojas',
};

export const ROLE_OPTIONS = [
  { value: 'ADMINISTRATOR', label: 'Administratorius' },
  { value: 'SALES_MANAGER', label: 'Pardavimų vadovas' },
  { value: 'SALES_AGENT', label: 'Pardavimų vadybininkas' },
  { value: 'PROJECT_DEVELOPER', label: 'Vystytojas' },
];

// ─── NORMALIZE ────────────────────────────────────────────────────────────────
// Visada naudoti prieš bet kokį permission checkę.

export const normalizeRole = (role) => {
  const map = { admin: 'ADMINISTRATOR', user: 'SALES_AGENT' };
  return map[role] || role;
};

// ─── PERMISSION HELPERS ───────────────────────────────────────────────────────
// ADMINISTRATOR visada turi absoliučią prieigą visur — apeina visus kitus checks.
// Visada perduoti rolę per normalizeRole() prieš naudojant šiuos helperius.

export const isAdministrator = (role) => normalizeRole(role) === 'ADMINISTRATOR';

export const canManageUsers    = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER';
export const canInviteUsers    = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER';
export const canManageBranding = (role) => isAdministrator(role);
export const canCreateProjects = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER';
export const canManageProjects = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER';
export const canManageUnits    = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER';
export const canViewAdminPages = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER';
export const canAccessInbound  = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER' || normalizeRole(role) === 'SALES_AGENT';
export const canManageInquiry  = (role) => isAdministrator(role) || normalizeRole(role) === 'SALES_MANAGER';

// ─── LEGACY (deprecated) ──────────────────────────────────────────────────────
// Palikta suderinamumui — naudoti tik helperius aukščiau.
export const CAN_MANAGE_USERS  = ['ADMINISTRATOR', 'SALES_MANAGER'];
export const CAN_MANAGE_BRANDING = ['ADMINISTRATOR'];
export const CAN_VIEW_USERS    = ['ADMINISTRATOR', 'SALES_MANAGER'];

// ─── STATUS LABELS ────────────────────────────────────────────────────────────

export const STATUS_LABELS = {
  // User account
  active:    'Aktyvus',
  disabled:  'Išjungtas',
  // Reservation
  reserved:   'Rezervuota',
  released:   'Atšaukta',
  converted:  'Konvertuota',
  overdue:    'Vėluoja',
  // Commission
  pending:    'Laukiama',
  approved:   'Patvirtinta',
  rejected:   'Atmesta',
  paid:       'Apmokėta',
  // Payout
  draft:      'Juodraštis',
  // Interest / CPI
  new_interest:  'Naujas',
  contacted:     'Susisiekta',
  considering:   'Svarsto',
  follow_up:     'Follow-up',
  completed:     'Baigta',
  // Deals / agreements
  signed:     'Pasirašyta',
  cancelled:  'Atšaukta',
  // Sale unit
  available:          'Laisvas',
  withheld:           'Sulaikytas',
  developer_reserved: 'Vystytojas',
  sold:               'Parduotas',
};

export const INVITE_STATUS_LABELS = {
  pending: 'Laukia',
  accepted: 'Priimtas',
  expired: 'Pasibaigęs',
  revoked: 'Atšauktas',
};