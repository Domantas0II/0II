import React from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeRole } from '@/lib/constants';

export default function SLADashboard() {
  const { user } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = normalizeRole(user?.role);

  const projectId = searchParams.get('projectId');

  // Access control
  const canView = role === 'SALES_MANAGER' || role === 'ADMINISTRATOR';

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-sla', user?.id, role],
    queryFn: async () => {
      if (role === 'ADMINISTRATOR') {
        return await base44.entities.Project.list('-created_date', 50);
      } else {
        const assignments = await base44.entities.UserProjectAssignment.filter({
          userId: user.id,
          removedAt: null
        });
        if (!assignments || assignments.length === 0) return [];
        const projectIds = assignments.map(a => a.projectId);
        const projects = [];
        for (const id of projectIds) {
          const result = await base44.entities.Project.filter({ id });
          if (result?.[0]) projects.push(result[0]);
        }
        return projects.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      }
    },
    enabled: !!user?.id
  });

  const selectedProjectId = projectId || projects[0]?.id;

  // Fetch tasks and SLA config for selected project
  const { data: allTasks = [] } = useQuery({
    queryKey: ['sla-tasks', selectedProjectId],
    queryFn: async () => {
      const response = await base44.functions.invoke('getTasks', {
        projectId: selectedProjectId
      });
      return response.data?.tasks || [];
    },
    enabled: !!selectedProjectId
  });

  const { data: slaConfig } = useQuery({
    queryKey: ['sla-config', selectedProjectId],
    queryFn: async () => {
      const configs = await base44.entities.SLAConfig.filter({
        projectId: selectedProjectId
      });
      return configs?.[0] || {
        escalationAfterMinutes: 60,
        escalationMaxLevel: 2
      };
    },
    enabled: !!selectedProjectId
  });

  // Calculate metrics
  const overdueTasks = allTasks.filter(t => t.status === 'overdue').length;
  const escalatedTasks = allTasks.filter(t => t.escalationLevel > 0).length;
  const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
  const completedTasks = allTasks.filter(t => t.status === 'completed').length;
  const totalTasks = allTasks.length;

  const overduePct = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const escalationPct = totalTasks > 0 ? Math.round((escalatedTasks / totalTasks) * 100) : 0;

  // Find most critical tasks
  const criticalTasks = allTasks
    .filter(t => t.status === 'overdue' || t.escalationLevel > 0)
    .sort((a, b) => {
      if (a.escalationLevel !== b.escalationLevel) return b.escalationLevel - a.escalationLevel;
      return new Date(a.dueAt) - new Date(b.dueAt);
    })
    .slice(0, 5);

  if (!canView) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Tik vadybininkai ir administratoriai gali peržiūrėti SLA ataskaitą
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SLA Vadyba</h1>
        <p className="text-sm text-muted-foreground mt-1">Atlikimo metrika ir realios laiko stebėsena</p>
      </div>

      {/* Project selector */}
      <Select value={selectedProjectId || ''} onValueChange={(id) => {
        setSearchParams({ projectId: id });
      }}>
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projects.map(proj => (
            <SelectItem key={proj.id} value={proj.id}>
              {proj.projectName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Iš viso</p>
            <p className="text-2xl font-bold text-primary">{totalTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Vykdomos</p>
            <p className="text-2xl font-bold text-blue-600">{inProgressTasks}</p>
          </CardContent>
        </Card>
        <Card className={cn(overdueTasks > 0 && 'border-red-200 bg-red-50')}>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Vėluojančios</p>
            <div className="flex items-center justify-between">
              <p className={cn('text-2xl font-bold', overdueTasks > 0 ? 'text-red-600' : 'text-gray-400')}>
                {overdueTasks}
              </p>
              <p className="text-xs font-medium">{overduePct}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(escalatedTasks > 0 && 'border-amber-200 bg-amber-50')}>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Eskalacijos</p>
            <div className="flex items-center justify-between">
              <p className={cn('text-2xl font-bold', escalatedTasks > 0 ? 'text-amber-600' : 'text-gray-400')}>
                {escalatedTasks}
              </p>
              <p className="text-xs font-medium">{escalationPct}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(completedTasks > 0 && 'border-green-200 bg-green-50')}>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Baigtos</p>
            <div className="flex items-center justify-between">
              <p className={cn('text-2xl font-bold', completedTasks > 0 ? 'text-green-600' : 'text-gray-400')}>
                {completedTasks}
              </p>
              <p className="text-xs font-medium">{completionPct}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLA Konfigūracija</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Eskalacija po</p>
              <p className="text-lg font-semibold">{slaConfig?.escalationAfterMinutes || 60} min</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Maksimalus lygis</p>
              <p className="text-lg font-semibold">{slaConfig?.escalationMaxLevel || 2}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Tasks */}
      {criticalTasks.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Kritinės užduotys ({criticalTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalTasks.map(task => (
                <div key={task.id} className="p-3 bg-white rounded border border-red-200">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm">{task.title}</h4>
                    <div className="flex gap-1">
                      {task.status === 'overdue' && (
                        <Badge variant="destructive">Vėluoja</Badge>
                      )}
                      {task.escalationLevel > 0 && (
                        <Badge className={cn(
                          task.escalationLevel === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        )}>
                          <Zap className="h-3 w-3 mr-1" />
                          L{task.escalationLevel}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Termin: {new Date(task.dueAt).toLocaleString('lt-LT')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: #{task.id?.slice(-6)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Tasks Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visos užduotys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>Iš viso: <span className="font-semibold text-foreground">{totalTasks}</span></p>
            <p>Vykdomos: <span className="font-semibold text-blue-600">{inProgressTasks}</span></p>
            <p>Vėluojančios: <span className="font-semibold text-red-600">{overdueTasks}</span></p>
            <p>Eskaluotos: <span className="font-semibold text-amber-600">{escalatedTasks}</span></p>
            <p>Baigtos: <span className="font-semibold text-green-600">{completedTasks}</span></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}