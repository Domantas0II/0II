export const ROLE_LABELS = {
  ADMIN: 'Administratorius',
  SALES_MANAGER: 'Pardavimų vadovas',
  SALES_AGENT: 'Pardavimų agentas',
  DEVELOPER: 'Programuotojas',
};

export const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administratorius' },
  { value: 'SALES_MANAGER', label: 'Pardavimų vadovas' },
  { value: 'SALES_AGENT', label: 'Pardavimų agentas' },
  { value: 'DEVELOPER', label: 'Programuotojas' },
];

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

export const CAN_MANAGE_USERS = ['ADMIN', 'SALES_MANAGER'];
export const CAN_MANAGE_BRANDING = ['ADMIN'];

export const PLACEHOLDER_PROJECTS = [
  { code: 'PROJ-001', name: 'Pavilnių Sodai' },
  { code: 'PROJ-002', name: 'Šilo Namai' },
  { code: 'PROJ-003', name: 'Centro Rezidencija' },
  { code: 'PROJ-004', name: 'Žvėryno Terasos' },
];