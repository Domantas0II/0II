/**
 * Publishing & Public Data Security Validation
 * 
 * CRITICAL: Ensures no internal data leaks to public endpoints
 */

// Fields SAFE to expose publicly
const PUBLIC_PROJECT_FIELDS = {
  id: true,
  projectName: true,
  projectCode: true,
  projectType: true,
  city: true,
  district: true,
  address: true,
  developerName: true,
  publicTitle: true,
  publicDescription: true,
  publicImages: true,
  created_date: true,
};

const PUBLIC_UNIT_FIELDS = {
  id: true,
  projectId: true,
  label: true,
  type: true,
  areaM2: true,
  price: true,
  publicPrice: true,
  pricePerM2: true,
  roomsCount: true,
  bathroomsCount: true,
  floor: true,
  buildingName: true,
  sectionName: true,
  phaseName: true,
  installationStatus: true,
  energyClass: true,
  constructionYear: true,
  hasBalcony: true,
  balconyAreaM2: true,
  hasTerrace: true,
  terraceAreaM2: true,
  hasGarage: true,
  windowDirections: true,
  publicComment: true,
  publicDescription: true,
  publicImages: true,
  cardVisualAssetId: true,
  created_date: true,
};

/**
 * Validates that project can be published
 */
export const canPublishProject = (project, completeness) => {
  if (!project.isActive) return false;
  if (project.projectLifecycleState !== 'published') return false;
  if (project.publicStatus !== 'ready') return false;
  if (!completeness?.readyForOperations) return false;
  return true;
};

/**
 * Validates that unit can be published
 */
export const canPublishUnit = (unit, project) => {
  if (unit.internalStatus !== 'available') return false;
  if (!project?.isPublic) return false;
  return true;
};

/**
 * Filters project data to only public-safe fields
 */
export const filterProjectForPublic = (project) => {
  const filtered = {};
  Object.keys(PUBLIC_PROJECT_FIELDS).forEach(key => {
    if (key in project) {
      filtered[key] = project[key];
    }
  });
  return filtered;
};

/**
 * Filters unit data to only public-safe fields
 */
export const filterUnitForPublic = (unit) => {
  const filtered = {};
  Object.keys(PUBLIC_UNIT_FIELDS).forEach(key => {
    if (key in unit) {
      filtered[key] = unit[key];
    }
  });
  // Use public price if available, otherwise use internal price
  if (!filtered.price && unit.price) {
    filtered.price = unit.price;
  }
  return filtered;
};

/**
 * Validates that no internal fields are leaked
 */
export const validateNoInternalLeak = (publicData, objectType) => {
  const allowedFields = objectType === 'project' ? PUBLIC_PROJECT_FIELDS : PUBLIC_UNIT_FIELDS;
  const internalFields = [
    'createdByUserId', 'assignedManagerUserId', 'reservedByUserId',
    'commission', 'commissionPercent', 'advance', 'advanceValue',
    'internalNotes', 'internalStatus',
    'clientId', 'clientProjectInterestId',
    'reservationLockToken', 'reservationLockAt'
  ];

  const foundInternal = [];
  Object.keys(publicData).forEach(key => {
    if (internalFields.includes(key) && !(key in allowedFields)) {
      foundInternal.push(key);
    }
  });

  return {
    safe: foundInternal.length === 0,
    leakedFields: foundInternal,
  };
};

export default {
  canPublishProject,
  canPublishUnit,
  filterProjectForPublic,
  filterUnitForPublic,
  validateNoInternalLeak,
};