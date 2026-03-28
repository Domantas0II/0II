export const RESERVATION_STATUS_LABELS = {
  active: 'Aktyvi',
  overdue: 'Pasibaigus laikui',
  released: 'Atleista',
  converted: 'Konvertuota'
};

export const RESERVATION_STATUS_COLORS = {
  active: 'bg-green-50 text-green-700 border-green-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  released: 'bg-gray-50 text-gray-700 border-gray-200',
  converted: 'bg-blue-50 text-blue-700 border-blue-200'
};

export const canManageReservations = (role) => {
  return ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);
};

export const canCreateReservations = (role) => {
  return ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT'].includes(role);
};

export const canReleaseReservations = (role) => {
  return ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);
};

export const canExtendReservations = (role) => {
  return ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT'].includes(role);
};