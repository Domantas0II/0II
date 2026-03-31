import { logWarning } from './logger';

const FlowErrors = {
  MISSING_INQUIRY: 'Trūksta projekto ir kliento duomenų',
  MISSING_INTEREST: 'Trūksta kliento susidomėjimo',
  MISSING_RESERVATION: 'Trūksta rezervacijos',
  MISSING_AGREEMENT: 'Trūksta sutarties',
  MISSING_DEAL: 'Trūksta sandorio',
  INVALID_STATUS_FLOW: 'Negalimas būsenos perjungimas',
  MISSING_COMMISSION_RULE: 'Nėra komisinio taisyklės',
  COMPANY_PAYMENT_NOT_RECEIVED: 'Įmonė dar negavo mokėjimo',
  INVALID_AMOUNT: 'Negalima suma'
};

const validateInquiry = (inquiry) => {
  if (!inquiry?.projectId || !inquiry?.clientId) {
    return { valid: false, error: FlowErrors.MISSING_INQUIRY };
  }
  return { valid: true };
};

const validateInterest = (interest) => {
  if (!interest?.projectId || !interest?.clientId) {
    return { valid: false, error: FlowErrors.MISSING_INTEREST };
  }
  return { valid: true };
};

const validateReservation = (reservation) => {
  if (!reservation?.projectId || !reservation?.bundleId || !reservation?.clientId) {
    return { valid: false, error: FlowErrors.MISSING_RESERVATION };
  }
  if (!['active', 'overdue', 'released', 'converted'].includes(reservation.status)) {
    return { valid: false, error: FlowErrors.INVALID_STATUS_FLOW };
  }
  return { valid: true };
};

const validateAgreement = (agreement) => {
  if (!agreement?.projectId || !agreement?.clientId || !agreement?.reservationId) {
    return { valid: false, error: FlowErrors.MISSING_AGREEMENT };
  }
  if (!['draft', 'signed', 'cancelled'].includes(agreement.status)) {
    return { valid: false, error: FlowErrors.INVALID_STATUS_FLOW };
  }
  return { valid: true };
};

const validateDeal = (deal) => {
  if (!deal?.projectId || !deal?.unitId || !deal?.clientId || !deal?.agreementId) {
    return { valid: false, error: FlowErrors.MISSING_DEAL };
  }
  if (!deal.soldAt || !deal.soldByUserId) {
    return { valid: false, error: 'Trūksta pardavimo duomenų' };
  }
  if (!deal.totalAmount || deal.totalAmount <= 0) {
    return { valid: false, error: FlowErrors.INVALID_AMOUNT };
  }
  return { valid: true };
};

const validateCommission = (commission) => {
  if (!commission?.dealId || !commission?.commissionRuleId) {
    return { valid: false, error: FlowErrors.MISSING_COMMISSION_RULE };
  }
  if (!commission.totalCommission || commission.totalCommission < 0) {
    return { valid: false, error: FlowErrors.INVALID_AMOUNT };
  }
  return { valid: true };
};

const validateCompanyPaymentReceived = (commission) => {
  if (commission?.role === 'manager' && commission?.companyCommissionReceiptStatus !== 'fully_received') {
    return { valid: false, error: FlowErrors.COMPANY_PAYMENT_NOT_RECEIVED };
  }
  return { valid: true };
};

const validateFlow = ({
  inquiry,
  interest,
  reservation,
  agreement,
  deal,
  commission
}) => {
  const errors = [];

  if (inquiry) {
    const inquiryResult = validateInquiry(inquiry);
    if (!inquiryResult.valid) errors.push(inquiryResult.error);
  }

  if (interest) {
    const interestResult = validateInterest(interest);
    if (!interestResult.valid) errors.push(interestResult.error);
  }

  if (reservation) {
    const reservationResult = validateReservation(reservation);
    if (!reservationResult.valid) errors.push(reservationResult.error);
  }

  if (agreement) {
    const agreementResult = validateAgreement(agreement);
    if (!agreementResult.valid) errors.push(agreementResult.error);
  }

  if (deal) {
    const dealResult = validateDeal(deal);
    if (!dealResult.valid) errors.push(dealResult.error);
  }

  if (commission) {
    const commissionResult = validateCommission(commission);
    if (!commissionResult.valid) errors.push(commissionResult.error);

    const paymentResult = validateCompanyPaymentReceived(commission);
    if (!paymentResult.valid) errors.push(paymentResult.error);
  }

  if (errors.length > 0) {
    logWarning('Flow validation failed', { errors });
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
};

export {
  FlowErrors,
  validateInquiry,
  validateInterest,
  validateReservation,
  validateAgreement,
  validateDeal,
  validateCommission,
  validateCompanyPaymentReceived,
  validateFlow
};