/**
 * Secondary Market Validation Guards
 * Prevents invalid state transitions
 */

export function validateSecondaryReservationCreation(data) {
  const { marketType, secondaryObjectId, secondaryBuyerProfileId, clientId, projectId, bundleId } = data;

  if (marketType === 'secondary') {
    // Must have SecondaryObject
    if (!secondaryObjectId) {
      throw new Error('Secondary reservation requires secondaryObjectId');
    }
    // Must have buyer (either profile or client)
    if (!secondaryBuyerProfileId && !clientId) {
      throw new Error('Secondary reservation requires either secondaryBuyerProfileId or clientId');
    }
    return true;
  }

  if (marketType === 'primary') {
    // Must have primary attributes
    if (!projectId || !bundleId) {
      throw new Error('Primary reservation requires projectId and bundleId');
    }
    return true;
  }

  throw new Error('Invalid marketType');
}

export function validateAgreementCreation(reservation) {
  if (!reservation) {
    throw new Error('Reservation not found');
  }
  if (!reservation.id) {
    throw new Error('Cannot create agreement: Invalid reservation');
  }
  return true;
}

export function validateDealCreation(agreement) {
  if (!agreement) {
    throw new Error('Agreement not found');
  }
  if (agreement.status !== 'signed') {
    throw new Error('Cannot create deal: Agreement must be signed');
  }
  return true;
}

export function validateSecondaryObjectData(data) {
  const requiredFields = ['title', 'address', 'city', 'propertyType', 'rooms', 'area', 'price', 'sellerClientId'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`SecondaryObject requires ${field}`);
    }
  }
  return true;
}

export function validateBuyerProfileData(data) {
  const requiredFields = ['clientId', 'city', 'propertyType', 'budgetMin', 'budgetMax', 'assignedAgentUserId'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new Error(`BuyerProfile requires ${field}`);
    }
  }
  
  if (data.budgetMin > data.budgetMax) {
    throw new Error('budgetMin cannot be greater than budgetMax');
  }
  
  return true;
}