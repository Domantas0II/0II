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

// ─── PERMISSION HELPERS ───────────────────────────────────────────────────────
// ADMINISTRATOR visada turi pilną prieigą — bypass visi kiti checks.

export const isAdmin = (role) => role === 'ADMINISTRATOR';

export const CAN_MANAGE_USERS = ['ADMINISTRATOR', 'SALES_MANAGER'];
export const CAN_MANAGE_BRANDING = ['ADMINISTRATOR'];
export const CAN_VIEW_USERS = ['ADMINISTRATOR', 'SALES_MANAGER'];

// ─── STATUS LABELS ────────────────────────────────────────────────────────────

export const STATUS_LABELS = {
  active: 'Aktyvus',
  disabled: 'Išjungtas',
};

export const INVITE_STATUS_LABELS = {
  pending: 'Laukia',
  accepted: 'Priimtas',
  expired: 'Pasibaigęs',
  revoked: 'Atšauktas',
};

// ─── PLACEHOLDER DATA ─────────────────────────────────────────────────────────

export const PLACEHOLDER_PROJECTS = [
  { code: 'PROJ-001', name: 'Pavilnių Sodai' },
  { code: 'PROJ-002', name: 'Šilo Namai' },
  { code: 'PROJ-003', name: 'Centro Rezidencija' },
  { code: 'PROJ-004', name: 'Žvėryno Terasos' },
];