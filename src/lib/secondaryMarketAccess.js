/**
 * Secondary Market Access Control
 * Determines who can view sensitive secondary market data
 */

export function canViewSensitiveSecondaryData(user, entity) {
  if (!user) return false;
  if (!entity) return false;

  const normalizedRole = user.role?.toUpperCase() || '';
  const isAdmin = normalizedRole === 'ADMINISTRATOR';
  const isSalesManager = normalizedRole.includes('SALES_MANAGER');
  const isAssignedAgent = entity.assignedAgentUserId === user.id;

  // Seller data (object details, pricing, commission)
  if (entity.sellerClientId || entity.objectStatus !== undefined) {
    return isAdmin || isSalesManager || isAssignedAgent;
  }

  // Buyer profile data (requirements, budget, financing)
  if (entity.budgetMin !== undefined || entity.budgetMax !== undefined) {
    return isAdmin || isSalesManager || isAssignedAgent;
  }

  // Media/gallery - all agents can view
  if (entity.imageUrls || entity.mainImageUrl) {
    return true;
  }

  // Default deny
  return false;
}

export function canEditSecondaryObject(user, object) {
  if (!user) return false;
  const normalizedRole = user.role?.toUpperCase() || '';
  return (
    normalizedRole === 'ADMINISTRATOR' ||
    normalizedRole.includes('SALES_MANAGER') ||
    object.assignedAgentUserId === user.id
  );
}

export function canEditBuyerProfile(user, profile) {
  if (!user) return false;
  const normalizedRole = user.role?.toUpperCase() || '';
  return (
    normalizedRole === 'ADMINISTRATOR' ||
    normalizedRole.includes('SALES_MANAGER') ||
    profile.assignedAgentUserId === user.id
  );
}

export function filterSecondaryDataByRole(entities, user) {
  if (!user) return [];
  const normalizedRole = user.role?.toUpperCase() || '';
  const isAdmin = normalizedRole === 'ADMINISTRATOR';
  const isSalesManager = normalizedRole.includes('SALES_MANAGER');

  return entities.filter(entity => {
    // Admins and sales managers see all
    if (isAdmin || isSalesManager) return true;
    // Regular agents see only their assigned objects
    return entity.assignedAgentUserId === user.id;
  });
}