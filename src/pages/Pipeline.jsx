import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { getAccessibleProjectIds, filterByAccessibleProjects } from '@/lib/queryAccess';
import { canViewPipeline, filterPipelineByRole } from '@/lib/pipelineAccess';
import { normalizeRole } from '@/lib/constants';
import { PIPELINE_STAGES } from '@/lib/pipelineConstants';
import PipelineColumn from '@/components/pipeline/PipelineColumn';

export default function Pipeline() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();

  const canAccess = canViewPipeline(normalizeRole(user?.role));
  if (!canAccess) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos prie pipeline</div>;
  }

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.Project.list('-created_date');
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: interests = [] } = useQuery({
    queryKey: ['pipelineInterests', user?.id, accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.ClientProjectInterest.list('-created_date');
      const filtered = filterByAccessibleProjects(all, accessibleIds);
      return filterPipelineByRole(filtered, user);
    },
    enabled: accessibleIds !== undefined && !!user?.id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.SaleUnit.list();
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', user?.id, accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.Activity.list('-scheduledAt');
      const filtered = filterByAccessibleProjects(all, accessibleIds);
      // Get last activity per client
      const lastByClient = {};
      filtered.forEach(a => {
        if (!lastByClient[a.clientId] || new Date(a.scheduledAt) > new Date(lastByClient[a.clientId].scheduledAt)) {
          lastByClient[a.clientId] = a;
        }
      });
      return Object.values(lastByClient);
    },
    enabled: accessibleIds !== undefined && !!user?.id,
  });

  const updateInterestStage = useMutation({
    mutationFn: (data) =>
      base44.entities.ClientProjectInterest.update(data.id, {
        pipelineStage: data.stage,
        stageUpdatedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelineInterests'] });
      toast.success('Stadija atnaujinta');
    },
    onError: () => toast.error('Nepavyko atnaujinti'),
  });

  const handleDrop = async (e, stage) => {
    e.preventDefault();
    const interestId = e.dataTransfer.getData('interestId');
    if (!interestId) return;

    updateInterestStage.mutate({ id: interestId, stage });
  };

  // Enrich interests with client data and unit
  const enrichedInterests = interests.map(i => ({
    ...i,
    fullName: clients.find(c => c.id === i.clientId)?.fullName || 'Unknown',
    unitId: i.unitId,
  }));

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));

  const overdueCount = enrichedInterests.filter(i => {
    if (!i.nextFollowUpAt) return false;
    return new Date(i.nextFollowUpAt) <= new Date() && !i.nextActivity;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{enrichedInterests.length} klientai</p>
      </div>

      {overdueCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-700">
            {overdueCount} klientam reikalingas follow-up
          </AlertDescription>
        </Alert>
      )}

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => (
          <PipelineColumn
            key={stage}
            stage={stage}
            interests={enrichedInterests}
            projects={Object.values(projectMap)}
            units={units}
            activities={activities}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}