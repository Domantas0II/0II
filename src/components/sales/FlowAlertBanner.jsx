import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle } from 'lucide-react';

/**
 * FlowAlertBanner
 *
 * Rodo flow integrity alertus dashboarde:
 * - Agreement be Deal (sutartis pasirašyta, bet Deal nesukurtas)
 * - Deal be Commission (>24h)
 * - Commission stuck not_received > X dienų
 * - Reservation expired + has Agreement
 */
export default function FlowAlertBanner({ deals = [], commissions = [], agreements = [], reservations = [] }) {
  const now = new Date();

  // 1. Agreements be Deal
  const signedAgreements = agreements.filter(a => a.status === 'signed');
  const dealAgreementIds = new Set(deals.map(d => d.agreementId));
  const agreementsWithoutDeal = signedAgreements.filter(a => !dealAgreementIds.has(a.id));

  // 2. Deals be Commission (>24h)
  const commissionDealIds = new Set(commissions.map(c => c.dealId));
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dealsWithoutCommission = deals.filter(d =>
    !commissionDealIds.has(d.id) && new Date(d.created_date) < cutoff24h
  );

  // 3. Commission stuck not_received > 14 days
  const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const stuckCommissions = commissions.filter(c =>
    c.companyCommissionReceiptStatus === 'not_received' &&
    new Date(c.calculatedAt) < cutoff14d
  );

  // 4. Reservation expired + has signed Agreement
  const reservationMap = Object.fromEntries(reservations.map(r => [r.id, r]));
  const dealReservationIds = new Set(deals.map(d => d.reservationId));
  const expiredWithAgreement = signedAgreements.filter(a => {
    const res = reservationMap[a.reservationId];
    if (!res) return false;
    const expired = res.status === 'released' || (new Date(res.expiresAt) < now && res.status !== 'converted');
    return expired && !dealReservationIds.has(res.id);
  });

  const alerts = [
    agreementsWithoutDeal.length > 0 && {
      color: 'red',
      icon: AlertCircle,
      label: `${agreementsWithoutDeal.length} pasirašyta sutartis be Pardavimo`,
      to: '/agreements',
    },
    dealsWithoutCommission.length > 0 && {
      color: 'red',
      icon: AlertCircle,
      label: `${dealsWithoutCommission.length} Pardavimas be Komisinio (>24h)`,
      to: '/deals',
    },
    expiredWithAgreement.length > 0 && {
      color: 'orange',
      icon: AlertTriangle,
      label: `${expiredWithAgreement.length} Rezervacija pasibaigusi, turi sutartį, bet nėra Pardavimo`,
      to: '/reservations',
    },
    stuckCommissions.length > 0 && {
      color: 'amber',
      icon: AlertTriangle,
      label: `${stuckCommissions.length} Komisinis laukia įmonės gavimo >14d`,
      to: '/commissions',
    },
  ].filter(Boolean);

  if (alerts.length === 0) return null;

  const colorMap = {
    red: 'bg-red-50 border-red-200 text-red-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flow integrity įspėjimai</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {alerts.map((alert, i) => {
          const Icon = alert.icon;
          return (
            <Link
              key={i}
              to={alert.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colorMap[alert.color]} hover:opacity-80 transition-opacity`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">{alert.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}