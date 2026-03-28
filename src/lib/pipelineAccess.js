export function canViewPipeline(role) {
  return role === 'ADMINISTRATOR' || role === 'SALES_MANAGER' || role === 'SALES_AGENT';
}

export function canManagePipeline(role) {
  return role === 'ADMINISTRATOR' || role === 'SALES_MANAGER';
}

export function filterPipelineByRole(interests, user) {
  if (!user || !interests) return [];

  if (user.role === 'ADMINISTRATOR') return interests;

  if (user.role === 'SALES_MANAGER') return interests;

  if (user.role === 'SALES_AGENT') {
    return interests.filter(i => i.assignedManagerUserId === user.id);
  }

  return [];
}

export function filterActivitiesByRole(activities, user) {
  if (!user || !activities) return [];

  if (user.role === 'ADMINISTRATOR') return activities;

  if (user.role === 'SALES_MANAGER') return activities;

  if (user.role === 'SALES_AGENT') {
    return activities.filter(a => a.assignedToUserId === user.id);
  }

  return [];
}