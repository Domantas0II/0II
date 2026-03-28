import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAgentPersonalStats, getOverdueAlerts } from '@/lib/analyticsHelpers';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import KPICard from '@/components/analytics/KPICard';
import AlertBanner from '@/components/analytics/AlertBanner';
import { AlertTriangle, Users, Briefcase, TrendingUp, Clock } from 'lucide-react';

export default function AgentDashboard({ projectIds, dateRange, setDateRange }) {
  const context = useOutletContext() || {};
  const { user } = context;

  const { data: stats } = useQuery({
    queryKey: ['agentPersonalStats', projectIds, user?.id],
    queryFn: () => getAgentPersonalStats(projectIds, user.id),
    enabled: projectIds?.length > 0 && !!user?.id,
  });

  const { data: alerts } = useQuery({
    queryKey: ['agentAlerts', projectIds, user?.id],
    queryFn: () => getOverdueAlerts(projectIds, user.id),
    enabled: projectIds?.length > 0 && !!user?.id,
  });

  const alertMessages = [];
  if (alerts?.overdueFollowUps?.length > 0) {
    alertMessages.push(`${alerts.overdueFollowUps.length} pasibaigusios sekimo sesijos`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Mano Skydelis</h1>
        <p className="text-sm text-muted-foreground mt-1">Operacinis žvilgsnis į mano darbą</p>
      </div>

      {/* Alerts */}
      {alertMessages.length > 0 && (
        <AlertBanner alerts={alertMessages} severity="warning" />
      )}

      {/* Quick Stats */}
      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard
            title="Mano klientai"
            value={stats.clients}
            icon={Users}
            color="primary"
          />
          <KPICard
            title="Aktyvūs suinteresuoti"
            value={stats.activeInterests}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Pasibaigusios sekos"
            value={stats.overdueFollowUps}
            icon={AlertTriangle}
            color="destructive"
          />
          <KPICard
            title="Mano rezervacijos"
            value={stats.reservations}
            icon={Briefcase}
            color="warning"
          />
          <KPICard
            title="Mano pardavimai"
            value={stats.deals}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Suma"
            value={`€${(stats.soldValue || 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            color="success"
          />
        </div>
      ) : null}

      {/* Action Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Veiklos Santrauka</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <span className="text-sm">Viso susidomėjimų</span>
            <Badge>{stats?.interests || 0}</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <span className="text-sm">Išspręsti suinteresuoti</span>
            <Badge variant="outline">{stats?.clients || 0}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Follow-ups */}
      {alerts?.overdueFollowUps && alerts.overdueFollowUps.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pasibaigusios Sekos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.overdueFollowUps.slice(0, 5).map(interest => (
                <div key={interest.id} className="p-2 rounded-lg bg-red-50 border border-red-200 text-sm">
                  <p className="font-medium text-red-900">{interest.clientId}</p>
                  <p className="text-xs text-red-700">Sekimas turėjo būti: {new Date(interest.nextFollowUpAt).toLocaleDateString('lt-LT')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}