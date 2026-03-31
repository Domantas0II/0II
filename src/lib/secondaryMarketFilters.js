/**
 * Secondary Market Filter Helpers
 */

export function filterByMarketType(entities, marketType) {
  if (!entities) return [];
  if (marketType === 'all') return entities;
  return entities.filter(e => e.marketType === marketType);
}

export function filterSecondaryObjectsByStatus(objects, status) {
  if (status === 'all') return objects;
  return objects.filter(obj => obj.objectStatus === status);
}

export function filterSecondaryObjectsByAgent(objects, agentUserId) {
  if (!agentUserId) return objects;
  return objects.filter(obj => obj.assignedAgentUserId === agentUserId);
}

export function filterBuyerProfilesByStatus(profiles, status) {
  if (status === 'all') return profiles;
  return profiles.filter(p => p.profileStatus === status);
}

export function filterBuyerProfilesByAgent(profiles, agentUserId) {
  if (!agentUserId) return profiles;
  return profiles.filter(p => p.assignedAgentUserId === agentUserId);
}

export function filterBuyerProfilesByCity(profiles, city) {
  if (!city) return profiles;
  return profiles.filter(p => p.city === city || p.city?.toLowerCase().includes(city?.toLowerCase()));
}

export function filterBuyerProfilesByBudget(profiles, minBudget, maxBudget) {
  return profiles.filter(p => {
    if (minBudget && p.budgetMax < minBudget) return false;
    if (maxBudget && p.budgetMin > maxBudget) return false;
    return true;
  });
}

export function filterReservationsByMarketType(reservations, marketType) {
  return filterByMarketType(reservations, marketType);
}

export function filterDealsByMarketType(deals, marketType) {
  return filterByMarketType(deals, marketType);
}

export function filterCommissionsByMarketType(commissions, marketType) {
  return filterByMarketType(commissions, marketType);
}

export function groupSecondaryObjectsByStatus(objects) {
  const grouped = {
    available: [],
    reserved: [],
    sold: [],
    paused: []
  };
  
  objects.forEach(obj => {
    if (grouped[obj.objectStatus]) {
      grouped[obj.objectStatus].push(obj);
    }
  });
  
  return grouped;
}

export function groupBuyerProfilesByStatus(profiles) {
  const grouped = {
    active: [],
    paused: [],
    completed: [],
    archived: []
  };
  
  profiles.forEach(p => {
    if (grouped[p.profileStatus]) {
      grouped[p.profileStatus].push(p);
    }
  });
  
  return grouped;
}

export function calculateSecondaryMarketMetrics(objects, profiles, deals) {
  return {
    totalObjects: objects?.length || 0,
    availableObjects: objects?.filter(o => o.objectStatus === 'available').length || 0,
    reservedObjects: objects?.filter(o => o.objectStatus === 'reserved').length || 0,
    soldObjects: objects?.filter(o => o.objectStatus === 'sold').length || 0,
    totalBuyers: profiles?.length || 0,
    activeBuyers: profiles?.filter(p => p.profileStatus === 'active').length || 0,
    totalDeals: deals?.length || 0,
    closedDeals: deals?.filter(d => d.marketType === 'secondary').length || 0
  };
}