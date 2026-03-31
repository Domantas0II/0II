import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { getProjectKpis, getReservationStats, getDealStats, getOverdueAlerts } from '@/lib/analyticsHelpers';
import KPICard from '@/components/analytics/KPICard';
import ManagerRankingBlock from '@/components/ranking/ManagerRankingBlock';
import ControlCriticalAlerts from './ControlCriticalAlerts';
import FlowAlertBanner from '@/components/sales/FlowAlertBanner';
import ControlPipelineBlocks from './ControlPipelineBlocks';
import ControlRecentDeals from './ControlRecentDeals';
import ControlInventoryBlock from './ControlInventoryBlock';
import { Home, Bookmark, CheckSquare, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

const MONTH_NAMES_LT = ['Sausis','Vasaris','Kovas','Balandis','Gegužė','Birželis',
  'Liepa','Rugpjūtis','Rugsėjis','Spalis','Lapkritis','Gruodis'];

export default function ManagerDashboard({ projectIds, projects }) {
  const hasProjectIds = projectIds === null || (Array.isArray(projectIds) && projectIds.length > 0);

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['projectKpis', projectIds],
    queryFn: () => getProjectKpis(projectIds),
    enabled: hasProjectIds,
  });

  const { data: reservationStats } = useQuery({
    queryKey: ['reservationStats', projectIds],
    queryFn: () => getReservationStats(projectIds),
    enabled: hasProjectIds,
  });

  const { data: dealStats } = useQuery({
    queryKey: ['dealStats', projectIds],
    queryFn: () => getDealStats(projectIds),
    enabled: hasProjectIds,
  });

  const { data: alerts } = useQuery({
    queryKey: ['overdueAlerts', projectIds],
    queryFn: () => getOverdueAlerts(projectIds, null),
    enabled: hasProjectIds,
  });

  const { data: allInterests = [] } = useQuery({
    queryKey: ['allInterests', projectIds],
    queryFn: async () => {
      const q = projectIds === null ? {} : { projectId: { $in: projectIds } };
      return base44.entities.ClientProjectInterest.filter(q);
    },
    enabled: hasProjectIds,
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['allClients'],
    queryFn: () => base44.entities.Client.list('-created_date', 500),
    enabled: hasProjectIds,
  });

  const { data: allUnits = [] } = useQuery({
    queryKey: ['allUnits', projectIds],
    queryFn: async () => {
      const q = projectIds === null ? {} : { projectId: { $in: projectIds } };
      return base44.entities.SaleUnit.filter(q);
    },
    enabled: hasProjectIds,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 200),
    enabled: hasProjectIds,
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ['agreements', projectIds],
    queryFn: async () => {
      const q = projectIds === null ? {} : { projectId: { $in: projectIds } };
      return base44.entities.Agreement.filter(q);
    },
    enabled: hasProjectIds,
  });

  const { data: allDeals = [] } = useQuery({
    queryKey: ['allDeals', projectIds],
    queryFn: async () => {
      const q = projectIds === null ? {} : { projectId: { $in: projectIds } };
      return base44.entities.Deal.filter(q);
    },
    enabled: hasProjectIds,
  });

  const { data: allCommissions = [] } = useQuery({
    queryKey: ['allCommissions', projectIds],
    queryFn: async () => {
      const q = projectIds === null ? {} : { projectId: { $in: projectIds } };
      return base44.entities.Commission.filter(q);
    },
    enabled: hasProjectIds,
  });

  const { data: allReservations = [] } = useQuery({
    queryKey: ['allReservations', projectIds],
    queryFn: async () => {
      const q = projectIds === null ? {} : { projectId: { $in: projectIds } };
      return base44.entities.Reservation.filter(q);
    },
    enabled: hasProjectIds,
  });

  // now computed inside render to avoid stale date on long sessions
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const monthStart = new Date(thisYear, thisMonth, 1);
  const yearStart = new Date(`${thisYear}-01-01T00:00:00.000Z`);
  const signedAgreements = agreements.filter(a => a.status === 'signed');
  const monthAgreements = signedAgreements.filter(a => a.signedAt && new Date(a.signedAt) >= monthStart).length;
  const yearAgreements = signedAgreements.filter(a => a.signedAt && new Date(a.signedAt) >= yearStart).length;

  const withheldCount = allUnits.filter(u => u.internalStatus === 'withheld' || u.internalStatus === 'developer_reserved').length;
  const unitStats = kpis ? { ...kpis.unitStats, withheld: withheldCount } : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Vadovybės kontrolė</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {MONTH_NAMES_LT[thisMonth]} {thisYear} · Tiesioginis snapshot
          </p>
        </div>
        <Link to="/team-performance" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
          Komandos analizė →
        </Link>
      </div>

      <ControlCriticalAlerts alerts={alerts} interests={allInterests} />

      <FlowAlertBanner
        deals={allDeals}
        commissions={allCommissions}
        agreements={agreements}
        reservations={allReservations}
      />

      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard title="Laisvi objektai" value={kpis.unitStats.available} icon={Home} color="success" />
          <KPICard title="Rezervuoti" value={kpis.unitStats.reserved} icon={Bookmark} color="warning" />
          <KPICard title="Parduoti" value={kpis.unitStats.sold} icon={CheckSquare} color="primary" />
          <KPICard title="Pasibaigusios rezervacijos" value={reservationStats?.overdue || 0} icon={AlertTriangle} color={reservationStats?.overdue > 0 ? 'destructive' : 'secondary'} />
          <KPICard title={`Sutarties vnt. — ${MONTH_NAMES_LT[thisMonth]}`} value={monthAgreements} icon={Calendar} color="primary" />
          <KPICard title={`Sutarties vnt. — ${thisYear}`} value={yearAgreements} icon={TrendingUp} color="success" />
        </div>
      ) : null}

      <ManagerRankingBlock />
      <ControlPipelineBlocks interests={allInterests} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ControlInventoryBlock unitStats={unitStats} />
        <ControlRecentDeals deals={dealStats?.deals || []} clients={allClients} units={allUnits} projects={projects} users={allUsers} />
      </div>
    </div>
  );
}