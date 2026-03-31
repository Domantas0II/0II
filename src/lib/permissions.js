const ROLES = {
  ADMIN: 'admin',
  SALES_MANAGER: 'sales_manager',
  SALES_AGENT: 'sales_agent',
  DEVELOPER: 'developer',
  USER: 'user'
};

const canViewDashboard = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_AGENT, ROLES.DEVELOPER].includes(user.role);
};

const canCreateDeal = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_AGENT].includes(user.role);
};

const canCreateReservation = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.SALES_AGENT].includes(user.role);
};

const canApprovePayout = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.SALES_MANAGER].includes(user.role);
};

const canApproveCommission = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.SALES_MANAGER].includes(user.role);
};

const canManageUsers = (user) => {
  if (!user) return false;
  return user.role === ROLES.ADMIN;
};

const canManageBranding = (user) => {
  if (!user) return false;
  return user.role === ROLES.ADMIN;
};

const canPublishProject = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.DEVELOPER].includes(user.role);
};

const canEditProject = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.DEVELOPER].includes(user.role);
};

const canViewReports = (user) => {
  if (!user) return false;
  return [ROLES.ADMIN, ROLES.SALES_MANAGER].includes(user.role);
};

const canManageSystemSettings = (user) => {
  if (!user) return false;
  return user.role === ROLES.ADMIN;
};

export {
  ROLES,
  canViewDashboard,
  canCreateDeal,
  canCreateReservation,
  canApprovePayout,
  canApproveCommission,
  canManageUsers,
  canManageBranding,
  canPublishProject,
  canEditProject,
  canViewReports,
  canManageSystemSettings
};