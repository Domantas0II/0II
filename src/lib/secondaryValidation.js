/**
 * Secondary Market Validation
 * Validates secondary market workflows and constraints
 */

export const validateSecondaryReservation = (reservation, secondaryObject, buyerProfile) => {
  const errors = [];

  // Mandatory: secondaryObject
  if (!secondaryObject || !secondaryObject.id) {
    errors.push('Reikalingas antrinės rinkos objektas (secondary object)');
  }

  // Mandatory: buyerProfile
  if (!buyerProfile || !buyerProfile.id) {
    errors.push('Reikalingas pirkėjo profilis');
  }

  // Status check
  if (secondaryObject && secondaryObject.status !== 'available') {
    errors.push(`Objektas nėra laisvas (statusas: ${secondaryObject.status})`);
  }

  // Price check against budget
  if (secondaryObject && buyerProfile) {
    if (buyerProfile.budgetMax && secondaryObject.price > buyerProfile.budgetMax) {
      errors.push(`Objekto kaina (€${secondaryObject.price}) viršija biudžetą (€${buyerProfile.budgetMax})`);
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validateSecondaryAgreement = (agreement, reservation, secondaryObject) => {
  const errors = [];

  // Mandatory: reservation
  if (!reservation || !reservation.id) {
    errors.push('Sutartis turi būti susieta su rezervacija');
  }

  // Mandatory: secondaryObject
  if (!secondaryObject || !secondaryObject.id) {
    errors.push('Sutartis turi būti susieta su objektu');
  }

  // Agreement type validation
  if (agreement && !['preliminary', 'reservation'].includes(agreement.agreementType)) {
    errors.push('Neteisingas sutarties tipas antrinėje rinkoje');
  }

  return { valid: errors.length === 0, errors };
};

export const validateSecondaryDeal = (deal, agreement, secondaryObject) => {
  const errors = [];

  // Mandatory: signed agreement
  if (!agreement || agreement.status !== 'signed') {
    errors.push('Sandoris turi būti susietas su pasirašyta sutartimi');
  }

  // Mandatory: secondaryObject
  if (!secondaryObject || !secondaryObject.id) {
    errors.push('Sandoris turi būti susietas su objektu');
  }

  // Amount validation
  if (deal && secondaryObject) {
    if (deal.totalAmount <= 0) {
      errors.push('Sandorio suma turi būti teigiama');
    }
    if (deal.totalAmount !== secondaryObject.price) {
      console.warn(
        `Perspėjimas: sandorio suma (€${deal.totalAmount}) nesutampa su objekto kaina (€${secondaryObject.price})`
      );
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validateSecondaryCommission = (commission, deal, secondaryObject) => {
  const errors = [];

  // Mandatory: deal
  if (!deal || !deal.id) {
    errors.push('Komisinis turi būti susietas su sandoriu');
  }

  // Mandatory: secondaryObject (for commission rule)
  if (!secondaryObject || !secondaryObject.id) {
    errors.push('Komisinis turi būti susietas su objektu');
  }

  // Commission type check
  if (secondaryObject) {
    if (secondaryObject.commissionType === 'percentage' && !secondaryObject.commissionPercent) {
      errors.push('Nustatytas procentinis komisinis, bet procentas nenustatytas');
    }
    if (secondaryObject.commissionType === 'fixed' && !secondaryObject.commissionFixedAmount) {
      errors.push('Nustatytas fiksuotas komisinis, bet suma nenustatyta');
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validateSecondaryObjectCreation = (data) => {
  const errors = [];

  if (!data.title) errors.push('Reikalingas objekto pavadinimas');
  if (!data.address) errors.push('Reikalingas adresas');
  if (!data.city) errors.push('Reikalingas miestas');
  if (!data.propertyType) errors.push('Reikalingas turto tipas');
  if (!data.rooms && data.rooms !== 0) errors.push('Reikalingas kambarių skaičius');
  if (!data.area) errors.push('Reikalingas plotas');
  if (!data.price || data.price <= 0) errors.push('Reikalinga teigiama kaina');
  if (!data.sellerClientId) errors.push('Reikalingas pardavėjo klientas');
  if (!data.commissionType) errors.push('Reikalingas komisinio tipas');

  if (data.commissionType === 'percentage' && !data.commissionPercent) {
    errors.push('Procentinio komisinio atveju reikalingas procentas');
  }
  if (data.commissionType === 'fixed' && !data.commissionFixedAmount) {
    errors.push('Fiksuoto komisinio atveju reikalinga suma');
  }

  return { valid: errors.length === 0, errors };
};

export const validateBuyerProfileCreation = (data) => {
  const errors = [];

  if (!data.clientId) errors.push('Reikalingas kliento ID');
  if (!data.propertyType) errors.push('Reikalingas pageidaujamas turto tipas');

  if (data.budgetMin && data.budgetMax && data.budgetMin > data.budgetMax) {
    errors.push('Minimalus biudžetas negali būti didesnis nei maksimalus');
  }

  return { valid: errors.length === 0, errors };
};