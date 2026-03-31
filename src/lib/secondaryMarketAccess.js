/**
 * Secondary Market Access Control
 * Manages permissions for secondary market entities
 */

export const canViewSecondaryObject = (user, secondaryObject) => {
  if (!user) return false;
  // Admins, managers, and assigned agents can view
  if (['admin', 'manager'].includes(user.role)) return true;
  if (secondaryObject.assignedAgentUserId === user.id) return true;
  return false;
};

export const canEditSecondaryObject = (user, secondaryObject) => {
  if (!user) return false;
  // Only admin, manager, or assigned agent can edit
  if (user.role === 'admin') return true;
  if (user.role === 'manager') return true;
  if (secondaryObject.assignedAgentUserId === user.id) return true;
  return false;
};

export const canViewSellerData = (user, secondaryObject) => {
  if (!user) return false;
  // Only owner (assigned agent), admin, manager can view seller data
  if (secondaryObject.assignedAgentUserId === user.id) return true;
  if (['admin', 'manager'].includes(user.role)) return true;
  return false;
};

export const canViewCommissionData = (user, secondaryObject) => {
  if (!user) return false;
  // Only owner (assigned agent), admin, manager can view commission data
  if (secondaryObject.assignedAgentUserId === user.id) return true;
  if (['admin', 'manager'].includes(user.role)) return true;
  return false;
};

export const canViewMediaGallery = (user) => {
  if (!user) return false;
  // All managers can view media
  if (['admin', 'manager', 'user'].includes(user.role)) return true;
  return false;
};

export const canViewBuyerProfile = (user, buyerProfile) => {
  if (!user) return false;
  // Assigned agent, admin, manager can view
  if (buyerProfile.assignedAgentUserId === user.id) return true;
  if (['admin', 'manager'].includes(user.role)) return true;
  return false;
};

export const canEditBuyerProfile = (user, buyerProfile) => {
  if (!user) return false;
  // Only assigned agent, admin, manager
  if (buyerProfile.assignedAgentUserId === user.id) return true;
  if (['admin', 'manager'].includes(user.role)) return true;
  return false;
};

export const canViewBuyerCommission = (user, buyerProfile) => {
  if (!user) return false;
  // Only owner, admin, manager
  if (buyerProfile.assignedAgentUserId === user.id) return true;
  if (['admin', 'manager'].includes(user.role)) return true;
  return false;
};

export const isSecondaryMarketEntity = (entity) => {
  return entity?.marketType === 'secondary';
};