import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { getAccessibleProjectIds } from '@/lib/queryAccess';
import { canViewPipeline, filterPipelineByRole } from '@/lib/pipelineAccess';
import { normalizeRole } from '@/lib/constants';
import { PIPELINE_STAGES } from '@/lib/pipelineConstants';
import PipelineColumn from '@/components/pipeline/PipelineColumn';

export default function Pipeline() {
  const { user } = useOutletContext() || {};
  const queryClient = useQueryClient();

  const canAccess = canViewPipeline(normalizeRole(user?.role));

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) {
        return await base44.entities.Project.list('-created_date', 50);
      }
      return await base44.entities.Project.filter({ 
        id: { $in: accessibleIds } 
      });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: interests = [] } = useQuery({
    queryKey: ['pipelineInterests', user?.id, accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) {
        const all = await base44.entities.ClientProjectInterest.list('-created_date', 50);
        return filterPipelineByRole(all, user);
      }
      const filtered = await base44.entities.ClientProjectInterest.filter({ 
        projectId: { $in: accessibleIds } 
      });
      return filterPipelineByRole(filtered, user);
    },
    enabled: accessibleIds !== undefined && !!user?.id,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['pipelineClients', interests.length],
    queryFn: async () => {
      // PERFORMANCE: Load only clients that appear in current pipeline interests
      // Instead of full client list, fetch just the ones we need
      if (interests.length === 0) return [];
      const clientIds = [...new Set(interests.map(i => i.clientId).filter(Boolean))];
      if (clientIds.length === 0) return [];
      return await base44.entities.Client.filter({
        id: { $in: clientIds }
      });
    },
    enabled: interests.length > 0,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.SaleUnit.list('-created_date', 50);
      return base44.entities.SaleUnit.filter({ projectId: { $in: accessibleIds } });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', user?.id, accessibleIds],
    queryFn: async () => {
      // PERFORMANCE: Query activities smartly based on access level
      // - null accessibleIds = ADMINISTRATOR, use limit to avoid full scan
      // - Otherwise filter by accessible projectIds server-side
      let activities;
      if (accessibleIds === null) {
        // Admin: limit to recent 500 activities (avoids unbounded full scan)
        activities = await base44.entities.Activity.list('-scheduledAt', 500);
      } else if (accessibleIds.length === 0) {
        return []; // No projects = no activities
      } else {
        // Filter activities by accessible projects server-side
        activities = await base44.entities.Activity.filter({
          projectId: { $in: accessibleIds },
          status: { $ne: 'cancelled' }
        });
      }
      
      // Get last activity per client (not cancelled)
      const lastByClient = {};
      activities
        .filter(a => a.projectId && a.status !== 'cancelled')
        .forEach(a => {
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

  const overdueCount = enrichedInterests.filter(i => {
    if (!i.nextFollowUpAt) return false;
    return new Date(i.nextFollowUpAt) <= new Date() && !i.nextActivity;
  }).length;

  if (!canAccess) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos prie pipeline</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pardavimų kanalas</h1>
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