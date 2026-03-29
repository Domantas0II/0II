import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getProjectKpis,
  getInquiryFunnel,
  getPipelineBreakdown,
  getReservationStats,
  getDealStats,
  getOverdueAlerts
} from '@/lib/analyticsHelpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import KPICard from '@/components/analytics/KPICard';
import FunnelChart from '@/components/analytics/FunnelChart';
import StatusChart from '@/components/analytics/StatusChart';
import AlertBanner from '@/components/analytics/AlertBanner';
import { Users, Building2, Briefcase, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

export default function AdminDashboard({ projectIds, projects }) {
  // Helper: check if projectIds is ready (null = full access, array = filtered)
  const hasProjectIds = projectIds === null || (Array.isArray(projectIds) && projectIds.length > 0);

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['projectKpis', projectIds],
    queryFn: () => getProjectKpis(projectIds),
    enabled: hasProjectIds,
  });

  const { data: inquiryFunnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['inquiryFunnel', projectIds],
    queryFn: () => getInquiryFunnel(projectIds),
    enabled: hasProjectIds,
  });

  const { data: pipelineBreakdown, isLoading: pipelineLoading } = useQuery({
    queryKey: ['pipelineBreakdown', projectIds],
    queryFn: () => getPipelineBreakdown(projectIds),
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

  const alertMessages = [];
  if (alerts?.overdueReservations?.length > 0) {
    alertMessages.push(`${alerts.overdueReservations.length} pasibaigusios rezervacijos`);
  }
  if (alerts?.staleInquiries?.length > 0) {
    alertMessages.push(`${alerts.staleInquiries.length} senos užklausos (nepriskyrtos)`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Vadovybės Kontrolė</h1>
        <p className="text-sm text-muted-foreground mt-1">Visos KPI duomenys: tiesioginis snapshot</p>
      </div>

      {/* Alerts */}
      {alertMessages.length > 0 && (
        <AlertBanner alerts={alertMessages} severity="critical" />
      )}

      {/* KPI Cards */}
      {kpisLoading ? (
        <div className="text-muted-foreground">Kraunasi...</div>
      ) : kpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Viso projektų"
            value={projects.length}
            icon={Building2}
            color="primary"
          />
          <KPICard
            title="Laisvų objektų"
            value={kpis.unitStats.available}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Rezervuotų"
            value={kpis.unitStats.reserved}
            icon={Briefcase}
            color="warning"
          />
          <KPICard
            title="Parduotų"
            value={kpis.unitStats.sold}
            icon={Users}
            color="primary"
          />
          <KPICard
            title="Pasibaigusios rezervacijos"
            value={reservationStats?.overdue || 0}
            icon={AlertTriangle}
            color="destructive"
          />
          <KPICard
            title="Sutartos"
            value={kpis.agreementStats.signed}
            icon={Briefcase}
            color="primary"
          />
          <KPICard
            title="Uždarytų darbų"
            value={dealStats?.total || 0}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Pardavimo suma"
            value={`€${(dealStats?.soldValue || 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            color="success"
          />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {funnelLoading ? null : inquiryFunnel ? (
          <FunnelChart data={inquiryFunnel} title="Užklausų Litvai" />
        ) : null}

        {pipelineLoading ? null : pipelineBreakdown ? (
          <FunnelChart data={pipelineBreakdown} title="Pipeline Stadijos" />
        ) : null}
      </div>

      {/* Units Distribution */}
      {kpis ? (
        <StatusChart
          data={[
            { name: 'Laisvai', value: kpis.unitStats.available },
            { name: 'Rezervuota', value: kpis.unitStats.reserved },
            { name: 'Parduota', value: kpis.unitStats.sold }
          ]}
          title="Objektų Paskirstymas"
        />
      ) : null}

      {/* Recent Deals */}
      {dealStats?.deals && dealStats.deals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Naujausias Pardavimai</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dealStats.deals.slice(0, 5).map(deal => (
                <div key={deal.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                  <span>{deal.clientId}</span>
                  <span className="font-medium">€{deal.totalAmount.toLocaleString('lt-LT')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}