/**
 * Secondary Market Access Control
 * Centralized permission layer for secondary market data visibility
 */

import { canApprovePayout } from './permissions';

/**
 * Determine user role (normalized)
 */
function normalizeRole(user) {
  if (!user) return null;
  const role = user.role?.toUpperCase() || '';
  if (role.includes('ADMIN')) return 'admin';
  if (role.includes('SALES_MANAGER') || role.includes('MANAGER')) return 'manager';
  if (role.includes('AGENT')) return 'agent';
  return 'user';
}

/**
 * Check if user can view seller data (object details, pricing, commission)
 * Seller data: owner + admin + sales manager
 */
export function canViewSellerData(user, entity) {
  if (!user || !entity) return false;
  
  const role = normalizeRole(user);
  const isOwner = entity.sellerClientId === user.id;
  const isAgent = entity.assignedAgentUserId === user.id;
  
  return role === 'admin' || role === 'manager' || isAgent;
}

/**
 * Check if user can view buyer data (requirements, budget, financing)
 * Buyer data: assigned agent + admin + sales manager
 */
export function canViewBuyerData(user, entity) {
  if (!user || !entity) return false;
  
  const role = normalizeRole(user);
  const isAgent = entity.assignedAgentUserId === user.id;
  
  return role === 'admin' || role === 'manager' || isAgent;
}

/**
 * Check if user can view commission data
 * Commission data: admin + sales manager
 */
export function canViewCommissionData(user) {
  if (!user) return false;
  return canApprovePayout(user);
}

/**
 * Check if user can view media (photos, plans)
 * Media: all agents
 */
export function canViewMedia(user) {
  if (!user) return false;
  const role = normalizeRole(user);
  return role === 'admin' || role === 'manager' || role === 'agent';
}

/**
 * Check if user can view financial data
 * Finance: all agents
 */
export function canViewFinancialData(user) {
  if (!user) return false;
  const role = normalizeRole(user);
  return role === 'admin' || role === 'manager' || role === 'agent';
}

/**
 * Unified sensitive data check
 */
export function canViewSensitiveSecondaryData(user, entity, dataType) {
  if (!user || !entity) return false;
  
  switch (dataType) {
    case 'seller':
      return canViewSellerData(user, entity);
    case 'buyer':
      return canViewBuyerData(user, entity);
    case 'commission':
      return canViewCommissionData(user);
    case 'media':
      return canViewMedia(user);
    case 'finance':
      return canViewFinancialData(user);
    default:
      return false;
  }
}

/**
 * Check if user can edit secondary object
 */
export function canEditSecondaryObject(user, object) {
  if (!user || !object) return false;
  const role = normalizeRole(user);
  const isAgent = object.assignedAgentUserId === user.id;
  
  return role === 'admin' || role === 'manager' || isAgent;
}

/**
 * Check if user can edit buyer profile
 */
export function canEditBuyerProfile(user, profile) {
  if (!user || !profile) return false;
  const role = normalizeRole(user);
  const isAgent = profile.assignedAgentUserId === user.id;
  
  return role === 'admin' || role === 'manager' || isAgent;
}

/**
 * Filter secondary objects by user role
 */
export function filterSecondaryObjects(objects, user) {
  if (!user || !Array.isArray(objects)) return [];
  
  const role = normalizeRole(user);
  
  // Admins and managers see all
  if (role === 'admin' || role === 'manager') {
    return objects;
  }
  
  // Agents see only their assigned
  if (role === 'agent') {
    return objects.filter(obj => obj.assignedAgentUserId === user.id);
  }
  
  // Others see nothing
  return [];
}

/**
 * Filter buyer profiles by user role
 */
export function filterBuyerProfiles(profiles, user) {
  if (!user || !Array.isArray(profiles)) return [];
  
  const role = normalizeRole(user);
  
  // Admins and managers see all
  if (role === 'admin' || role === 'manager') {
    return profiles;
  }
  
  // Agents see only their assigned
  if (role === 'agent') {
    return profiles.filter(p => p.assignedAgentUserId === user.id);
  }
  
  // Others see nothing
  return [];
}

/**
 * Filter secondary data by type
 */
export function filterSecondaryData(entities, user, entityType) {
  if (entityType === 'SecondaryObject') {
    return filterSecondaryObjects(entities, user);
  }
  if (entityType === 'SecondaryBuyerProfile') {
    return filterBuyerProfiles(entities, user);
  }
  return [];
}

/**
 * Mask sensitive fields in object (for API responses)
 */
export function maskSecondaryObjectFields(object, user, includeFields = []) {
  if (!object) return null;
  
  const canViewSeller = canViewSellerData(user, object);
  const canViewCommission = canViewCommissionData(user);
  
  const masked = { ...object };
  
  if (!canViewSeller) {
    delete masked.sellerClientId;
    delete masked.commissionPercent;
    delete masked.commissionFixedAmount;
  }
  
  if (!canViewCommission) {
    delete masked.commissionType;
    delete masked.commissionPercent;
    delete masked.commissionFixedAmount;
  }
  
  return masked;
}

/**
 * Mask sensitive fields in buyer profile (for API responses)
 */
export function maskBuyerProfileFields(profile, user) {
  if (!profile) return null;
  
  const canViewBuyer = canViewBuyerData(user, profile);
  const canViewCommission = canViewCommissionData(user);
  
  const masked = { ...profile };
  
  if (!canViewBuyer) {
    delete masked.budgetMin;
    delete masked.budgetMax;
    delete masked.financingStatus;
  }
  
  if (!canViewCommission) {
    delete masked.commissionType;
    delete masked.searchCommissionPercent;
    delete masked.negotiationBonusPercent;
  }
  
  return masked;
}