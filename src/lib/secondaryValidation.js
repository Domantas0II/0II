/**
 * Secondary Market Validation Guards
 * Ensures secondary market data integrity
 */

import {
  canTransitionObjectStatus,
  canTransitionBuyerStatus
} from './secondaryPipelineConfig';

/**
 * Validates secondary object data
 */
export function validateSecondaryObject(object) {
  const errors = [];

  if (!object.title) errors.push('Objekto pavadinimas reikalingas');
  if (!object.address) errors.push('Adresas reikalingas');
  if (!object.city) errors.push('Miestas reikalingas');
  if (!object.propertyType) errors.push('Nuosavybės tipas reikalingas');
  if (!object.rooms) errors.push('Kambarių skaičius reikalingas');
  if (!object.area) errors.push('Plotas reikalingas');
  if (!object.price || object.price <= 0) errors.push('Kaina turi būti > 0');
  if (!object.assignedAgentUserId) errors.push('Agentas reikalingas');
  if (!object.sellerClientId) errors.push('Pardavėjas reikalingas');

  // Validate commission
  if (object.commissionType === 'percentage') {
    if (!object.commissionPercent || object.commissionPercent <= 0) {
      errors.push('Komisinio procentas reikalingas');
    }
  } else if (object.commissionType === 'fixed') {
    if (!object.commissionFixedAmount || object.commissionFixedAmount <= 0) {
      errors.push('Fiksuota komisinio suma reikalinga');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates secondary buyer profile data
 */
export function validateSecondaryBuyerProfile(profile) {
  const errors = [];

  if (!profile.clientId) errors.push('Kliento ID reikalingas');
  if (!profile.assignedAgentUserId) errors.push('Agentas reikalingas');
  if (!profile.city) errors.push('Miestas reikalingas');
  if (!profile.propertyType) errors.push('Nuosavybės tipas reikalingas');
  if (!profile.budgetMin || profile.budgetMin <= 0) errors.push('Minimalus biudžetas reikalingas');
  if (!profile.budgetMax || profile.budgetMax <= 0) errors.push('Maksimalus biudžetas reikalingas');
  if (profile.budgetMin > profile.budgetMax) errors.push('Minimalus biudžetas negali viršyti maksimalaus');

  if (profile.areaMin && profile.areaMax && profile.areaMin > profile.areaMax) {
    errors.push('Minimalus plotas negali viršyti maksimalaus');
  }

  // Validate commission
  if (profile.commissionType === 'percentage') {
    if (profile.searchCommissionPercent !== undefined && profile.searchCommissionPercent < 0) {
      errors.push('Komisinio procentas negali būti neigiamas');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates secondary reservation creation
 * Ensures proper linking of object + buyer
 */
export function validateSecondaryReservation(data) {
  const errors = [];

  // Market type check
  if (data.marketType !== 'secondary') {
    errors.push('Šis validatorius skirtas tik secondary rinkos rezervacijoms');
  }

  // Object required
  if (!data.secondaryObjectId) {
    errors.push('Objekto ID reikalingas secondary rezervacijai');
  }

  // Buyer required (profile OR client)
  if (!data.secondaryBuyerProfileId && !data.clientId) {
    errors.push('Reikalingas pirkėjas (profilis arba klientas)');
  }

  // Expiration
  if (!data.expiresAt) {
    errors.push('Rezervacijos galiojimo laikas reikalingas');
  }

  // Reserved by
  if (!data.reservedByUserId) {
    errors.push('Atsakingas agentas reikalingas');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates secondary agreement
 */
export function validateSecondaryAgreement(agreement) {
  const errors = [];

  if (!agreement.reservationId) errors.push('Rezervacijos ID reikalingas');
  if (!agreement.clientId) errors.push('Kliento ID reikalingas');
  if (!agreement.agreementType) errors.push('Sutarties tipas reikalingas');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates secondary deal
 */
export function validateSecondaryDeal(deal) {
  const errors = [];

  if (!deal.secondaryObjectId) errors.push('Objekto ID reikalingas');
  if (!deal.clientId) errors.push('Kliento ID reikalingas');
  if (!deal.reservationId) errors.push('Rezervacijos ID reikalingas');
  if (!deal.agreementId) errors.push('Sutarties ID reikalingas');
  if (!deal.soldAt) errors.push('Pardavimo data reikalinga');
  if (!deal.soldByUserId) errors.push('Pardavę agentas reikalingas');
  if (!deal.totalAmount || deal.totalAmount <= 0) errors.push('Suma turi būti > 0');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates status transition
 */
export function validateObjectStatusTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) {
    return { valid: true, errors: [] };
  }

  const canTransition = canTransitionObjectStatus(currentStatus, newStatus);
  if (!canTransition) {
    return {
      valid: false,
      errors: [`Negali pereiti iš ${currentStatus} į ${newStatus}`]
    };
  }

  return { valid: true, errors: [] };
}

export function validateBuyerStatusTransition(currentStatus, newStatus) {
  if (currentStatus === newStatus) {
    return { valid: true, errors: [] };
  }

  const canTransition = canTransitionBuyerStatus(currentStatus, newStatus);
  if (!canTransition) {
    return {
      valid: false,
      errors: [`Negali pereiti iš ${currentStatus} į ${newStatus}`]
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates object-buyer match
 */
export function validateObjectBuyerMatch(object, buyer) {
  const errors = [];

  // Budget check
  if (buyer.budgetMin > object.price || buyer.budgetMax < object.price) {
    errors.push('Objekto kaina nepatenka į pirkėjo biudžetą');
  }

  // Property type check
  if (buyer.propertyType && buyer.propertyType !== object.propertyType) {
    errors.push('Objekto tipas neatitinka pirkėjo pageidavimo');
  }

  // Location check
  if (buyer.city && buyer.city !== object.city) {
    errors.push('Objekto miestas neatitinka pirkėjo pageidavimo');
  }

  // Area check
  if (buyer.areaMin && object.area < buyer.areaMin) {
    errors.push('Objekto plotas mažesnis nei minimalus');
  }
  if (buyer.areaMax && object.area > buyer.areaMax) {
    errors.push('Objekto plotas didesnis nei maksimalus');
  }

  // Rooms check
  if (buyer.rooms && buyer.rooms !== object.rooms) {
    errors.push('Objekto kambarių skaičius neatitinka pageidavimo');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}