import { base44 } from '@/api/base44Client';

// Memory cache
const cache = {
  settings: new Map(),
  flags: new Map(),
  limits: new Map(),
  lastInvalidated: Date.now()
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default values fallback
const DEFAULTS = {
  settings: {
    // CRM
    'crm.defaultPipelineStages': ['new', 'contacted', 'consultation', 'visit', 'negotiation', 'reserved', 'won', 'lost'],
    'crm.defaultReservationDurationHours': 48,
    'crm.defaultFollowUpIntervalHours': 24,

    // SLA
    'sla.escalationLevel1Hours': 2,
    'sla.escalationLevel2Hours': 6,
    'sla.maxEscalationLevel': 2,

    // Import
    'import.maxRowsPerImport': 1000,
    'import.allowedFileTypes': ['csv', 'xlsx'],

    // Public Portal
    'portal.publicProjectsLimit': 50,
    'portal.publicUnitsLimit': 100,

    // File Management
    'file.maxFileSizeMB': 100,
    'file.allowedMimeTypes': ['image/jpeg', 'image/png', 'application/pdf', 'text/csv', 'application/vnd.ms-excel'],

    // Scoring
    'scoring.inquiryWeights': { freshness: 0.3, message: 0.2, status: 0.5 },
    'scoring.clientWeights': { interests: 0.3, activity: 0.4, tasks: 0.3 },
    'scoring.reservationWeights': { stage: 0.5, interaction: 0.3, time: 0.2 },
    'scoring.dealWeights': { agreement: 0.4, payments: 0.3, conversion: 0.3 }
  },
  limits: {
    'import.maxRows': 1000,
    'api.maxRetries': 3,
    'file.maxSizeMB': 100,
    'analytics.maxQueryDays': 365,
    'performance.maxConcurrentImports': 5
  }
};

/**
 * Get raw setting value from cache or DB
 */
export async function getSetting(key) {
  const isCacheValid = Date.now() - cache.lastInvalidated < CACHE_TTL;

  if (isCacheValid && cache.settings.has(key)) {
    return cache.settings.get(key);
  }

  try {
    const settings = await base44.entities.SystemSetting.filter({ key });
    if (settings && settings.length > 0) {
      const setting = settings[0];
      cache.settings.set(key, setting);
      return setting;
    }
  } catch (error) {
    console.warn(`Failed to fetch setting ${key}:`, error.message);
  }

  return null;
}

/**
 * Get parsed setting value with fallback
 */
export async function getSettingValue(key, defaultValue = null) {
  const setting = await getSetting(key);

  if (setting) {
    try {
      return JSON.parse(setting.valueJson);
    } catch (e) {
      console.warn(`Failed to parse setting ${key}:`, e.message);
      return DEFAULTS.settings[key] || defaultValue;
    }
  }

  return DEFAULTS.settings[key] || defaultValue;
}

/**
 * Get system limit value
 */
export async function getSystemLimit(key) {
  const isCacheValid = Date.now() - cache.lastInvalidated < CACHE_TTL;

  if (isCacheValid && cache.limits.has(key)) {
    return cache.limits.get(key).value;
  }

  try {
    const limits = await base44.entities.SystemLimit.filter({ key });
    if (limits && limits.length > 0) {
      const limit = limits[0];
      cache.limits.set(key, limit);
      return limit.value;
    }
  } catch (error) {
    console.warn(`Failed to fetch limit ${key}:`, error.message);
  }

  return DEFAULTS.limits[key] || null;
}

/**
 * Get feature flag status with user context
 */
export async function getFeatureFlag(key, user = null) {
  const isCacheValid = Date.now() - cache.lastInvalidated < CACHE_TTL;

  if (isCacheValid && cache.flags.has(key)) {
    const flag = cache.flags.get(key);
    return evaluateFlag(flag, user);
  }

  try {
    const flags = await base44.entities.FeatureFlag.filter({ key });
    if (flags && flags.length > 0) {
      const flag = flags[0];
      cache.flags.set(key, flag);
      return evaluateFlag(flag, user);
    }
  } catch (error) {
    console.warn(`Failed to fetch flag ${key}:`, error.message);
  }

  return false;
}

/**
 * Evaluate feature flag based on rollout type
 */
function evaluateFlag(flag, user) {
  if (!flag.isEnabled) {
    return false;
  }

  if (flag.rolloutType === 'all') {
    return true;
  }

  if (flag.rolloutType === 'role_based') {
    if (!user || !user.role) {
      return false;
    }
    const normalizedRole = normalizeRole(user.role);
    return flag.allowedRoles && flag.allowedRoles.includes(normalizedRole);
  }

  if (flag.rolloutType === 'percentage') {
    if (!user || !user.id) {
      return false;
    }
    // Deterministic hash based on user ID
    const hash = hashUserIdToPercentage(user.id);
    return hash < (flag.percentage || 0);
  }

  return false;
}

/**
 * Deterministic percentage hash for user
 */
function hashUserIdToPercentage(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Normalize role names
 */
function normalizeRole(role) {
  const map = {
    'admin': 'ADMINISTRATOR',
    'user': 'SALES_AGENT',
    'manager': 'SALES_MANAGER',
    'developer': 'PROJECT_DEVELOPER'
  };
  return map[role?.toLowerCase()] || role;
}

/**
 * Invalidate cache (call after update)
 */
export function invalidateCache() {
  cache.settings.clear();
  cache.flags.clear();
  cache.limits.clear();
  cache.lastInvalidated = Date.now();
}

/**
 * Get all settings by category (for admin panel)
 */
export async function getSettingsByCategory(category) {
  try {
    const settings = await base44.entities.SystemSetting.filter({ category });
    return settings || [];
  } catch (error) {
    console.warn(`Failed to fetch settings for category ${category}:`, error.message);
    return [];
  }
}

/**
 * Get all feature flags (for admin panel)
 */
export async function getAllFeatureFlags() {
  try {
    const flags = await base44.entities.FeatureFlag.list('-updated_date');
    return flags || [];
  } catch (error) {
    console.warn('Failed to fetch feature flags:', error.message);
    return [];
  }
}

/**
 * Get all limits (for admin panel)
 */
export async function getAllSystemLimits() {
  try {
    const limits = await base44.entities.SystemLimit.list('-updated_date');
    return limits || [];
  } catch (error) {
    console.warn('Failed to fetch system limits:', error.message);
    return [];
  }
}