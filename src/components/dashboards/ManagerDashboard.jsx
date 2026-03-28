import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjectKpis, getOverdueAlerts } from '@/lib/analyticsHelpers';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import KPICard from '@/components/analytics/KPICard';
import AlertBanner from '@/components/analytics/AlertBanner';
import { Briefcase, Users, TrendingUp, AlertTriangle } from 'lucide-react';

export default function ManagerDashboard({ projectIds, projects }) {
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['projectKpis', projectIds],
    queryFn: () => getProjectKpis(projectIds),
    enabled: projectIds?.length > 0,
  });

  const { data: alerts } = useQuery({
    queryKey: ['overdueAlerts', projectIds],
    queryFn: () => getOverdueAlerts(projectIds, null),
    enabled: projectIds?.length > 0,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['agentUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 100),
    enabled: projectIds?.length > 0,
  });

  const alertMessages = [];
  if (alerts?.overdueReservations?.length > 0) {
    alertMessages.push(`${alerts.overdueReservations.length} pasibaigusios rezervacijos`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Vadybininko Skydelis</h1>
        <p className="text-sm text-muted-foreground mt-1">Komandos apžvalga: tiesioginis snapshot</p>
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
            title="Viso rezervacijų"
            value={kpis.reservationStats.total}
            icon={Briefcase}
            color="primary"
          />
          <KPICard
            title="Naujos užklausos"
            value={kpis.inquiryStats.new}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Paverstos užklausos"
            value={kpis.inquiryStats.converted}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Pasirašytos sutartys"
            value={kpis.agreementStats.signed}
            icon={Briefcase}
            color="primary"
          />
          <KPICard
            title="Pasibaigusios"
            value={alerts?.overdueReservations?.length || 0}
            icon={AlertTriangle}
            color="destructive"
          />
        </div>
      ) : null}

      {/* Team overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Komandos Apžvalga</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {projects.length} projektų · {kpis?.unitStats.total || 0} objektų
          </p>
        </CardContent>
      </Card>
    </div>
  );
}