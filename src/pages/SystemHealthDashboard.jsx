import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, RefreshCw, Activity, Bug, FlaskConical, FileWarning } from 'lucide-react';

const STATUS_CONFIG = {
  ok:       { color: 'text-green-600',      bg: 'bg-green-50 border-green-200',      icon: CheckCircle2,   badge: 'bg-green-100 text-green-800' },
  warning:  { color: 'text-yellow-600',     bg: 'bg-yellow-50 border-yellow-200',    icon: AlertTriangle,  badge: 'bg-yellow-100 text-yellow-800' },
  critical: { color: 'text-destructive',    bg: 'bg-red-50 border-red-200',          icon: XCircle,        badge: 'bg-red-100 text-red-800' },
};

const CHECK_LABELS = {
  db_connectivity: 'Duomenų bazė',
  webhook_failures_1h: 'Webhook klaidos (1h)',
  unprocessed_events: 'Neapdoroti eventai',
  sla_overdue_tasks: 'SLA vėluojančios užduotys',
  stuck_reservations: 'Įstrigusios rezervacijos',
  failed_imports: 'Nepavykę importai',
  missing_commissions: 'Trūkstami komisiniai',
  failed_scheduled_reports: 'Nepavykusios ataskaitos',
  webhook_endpoints: 'Webhook endpointai',
};

export default function SystemHealthDashboard() {
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const { data: checks = [], isLoading } = useQuery({
    queryKey: ['health-checks'],
    queryFn: () => base44.entities.SystemHealthCheck.list('-checkedAt', 200),
    refetchInterval: 60000
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-open'],
    queryFn: () => base44.entities.SystemIncident.list('-created_date', 100),
    refetchInterval: 30000
  });

  const runHealthMutation = useMutation({
    mutationFn: () => base44.functions.invoke('runSystemHealthChecks', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['health-checks'] });
      queryClient.invalidateQueries({ queryKey: ['incidents-open'] });
      const d = res.data;
      toast.success(`Health checks: ${d.ok} OK, ${d.warning} warning, ${d.critical} critical`);
    },
    onError: () => toast.error('Health check nepavyko')
  });

  const detectMutation = useMutation({
    mutationFn: () => base44.functions.invoke('detectIncidents', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['incidents-open'] });
      toast.success(`Incident detection: ${res.data.incidentsCreated} naujų incidentų`);
    },
    onError: () => toast.error('Incident detection nepavyko')
  });

  // Get latest check per name
  const latestByName = {};
  for (const c of checks) {
    if (!latestByName[c.checkName]) latestByName[c.checkName] = c;
  }
  const latestChecks = Object.values(latestByName);
  const openIncidents = incidents.filter(i => i.status !== 'resolved');
  const criticalCount = latestChecks.filter(c => c.status === 'critical').length;
  const warningCount = latestChecks.filter(c => c.status === 'warning').length;
  const okCount = latestChecks.filter(c => c.status === 'ok').length;
  const lastRun = checks[0]?.checkedAt;

  const overallStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok';
  const OverallIcon = STATUS_CONFIG[overallStatus]?.icon || CheckCircle2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" /> System Health
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {lastRun ? `Paskutinis patikrinimas: ${new Date(lastRun).toLocaleString('lt-LT')}` : 'Dar nevykdyta'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => detectMutation.mutate()} disabled={detectMutation.isPending} className="gap-2">
              <Activity className="h-4 w-4" />Aptikti incidentus
            </Button>
            <Button onClick={() => runHealthMutation.mutate()} disabled={runHealthMutation.isPending} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${runHealthMutation.isPending ? 'animate-spin' : ''}`} />
              Vykdyti patikrinimą
            </Button>
          </div>
        )}
      </div>

      {/* Overall status banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${STATUS_CONFIG[overallStatus].bg}`}>
        <OverallIcon className={`h-8 w-8 ${STATUS_CONFIG[overallStatus].color}`} />
        <div>
          <p className={`text-lg font-bold ${STATUS_CONFIG[overallStatus].color}`}>
            {overallStatus === 'ok' ? 'Sistema veikia normaliai' : overallStatus === 'warning' ? 'Yra perspėjimų' : 'KRITINĖ PROBLEMA'}
          </p>
          <p className="text-sm text-muted-foreground">{okCount} OK · {warningCount} perspėjimų · {criticalCount} kritinių · {openIncidents.length} atvirų incidentų</p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="flex gap-2 flex-wrap">
        <Link to="/incidents"><Button variant="outline" size="sm" className="gap-2"><Bug className="h-4 w-4" />Incidentai ({openIncidents.length})</Button></Link>
        <Link to="/data-integrity"><Button variant="outline" size="sm" className="gap-2"><FileWarning className="h-4 w-4" />Duomenų integrumas</Button></Link>
        <Link to="/system-tests"><Button variant="outline" size="sm" className="gap-2"><FlaskConical className="h-4 w-4" />Sistemos testai</Button></Link>
      </div>

      {/* Health check grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : latestChecks.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          Health checks dar nevykdyti. Spauskite "Run Health Checks".
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {latestChecks.map(check => {
            const cfg = STATUS_CONFIG[check.status];
            const Icon = cfg.icon;
            return (
              <Card key={check.checkName} className={`border ${cfg.bg}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{CHECK_LABELS[check.checkName] || check.checkName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{check.message}</p>
                      <p className="text-xs text-muted-foreground mt-1 opacity-60">
                        {new Date(check.checkedAt).toLocaleTimeString('lt-LT')}
                      </p>
                    </div>
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Open incidents preview */}
      {openIncidents.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Atviri incidentai ({openIncidents.length})</h2>
          <div className="space-y-2">
            {openIncidents.slice(0, 5).map(inc => (
              <Link key={inc.id} to={`/incidents/${inc.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={inc.severity === 'critical' ? 'bg-red-100 text-red-800' : inc.severity === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}>
                          {inc.severity}
                        </Badge>
                        <span className="font-medium text-sm truncate">{inc.incidentType.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{inc.description}</p>
                    </div>
                    <Badge variant={inc.status === 'investigating' ? 'default' : 'secondary'}>{inc.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {openIncidents.length > 5 && (
              <Link to="/incidents"><Button variant="ghost" size="sm">Rodyti visus ({openIncidents.length}) →</Button></Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}