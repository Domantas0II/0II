import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { getAccessibleProjectIds } from '@/lib/queryAccess';
import { canViewPipeline, filterPipelineByRole } from '@/lib/pipelineAccess';
import { normalizeRole } from '@/lib/constants';
import { PIPELINE_STAGES, normalizePipelineStage, STAGE_OVERDUE_THRESHOLD_DAYS } from '@/lib/pipelineConstants';
import { differenceInDays } from 'date-fns';
import PipelineColumn from '@/components/pipeline/PipelineColumn';
import PipelineMobileView from '@/components/pipeline/PipelineMobileView';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function isInterestOverdue(interest) {
  const now = new Date();
  if (interest.nextFollowUpAt && new Date(interest.nextFollowUpAt) < now) return true;
  const threshold = STAGE_OVERDUE_THRESHOLD_DAYS[interest.pipelineStage] || 7;
  const stageDate = interest.stageUpdatedAt || interest.created_date;
  if (stageDate && differenceInDays(now, new Date(stageDate)) > threshold) return true;
  return false;
}

export default function Pipeline() {
  const { user } = useOutletContext() || {};
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const canAccess = canViewPipeline(normalizeRole(user?.role));

  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.Project.list('-created_date', 50);
      return base44.entities.Project.filter({ id: { $in: accessibleIds } });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: rawInterests = [] } = useQuery({
    queryKey: ['pipelineInterests', user?.id, accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) {
        const all = await base44.entities.ClientProjectInterest.list('-created_date', 200);
        return filterPipelineByRole(all, user);
      }
      const filtered = await base44.entities.ClientProjectInterest.filter({ projectId: { $in: accessibleIds } });
      return filterPipelineByRole(filtered, user);
    },
    enabled: accessibleIds !== undefined && !!user?.id,
  });

  // Normalize legacy stage keys
  const normalizedInterests = rawInterests.map(i => ({
    ...i,
    pipelineStage: normalizePipelineStage(i.pipelineStage || 'new_contact'),
  }));

  const { data: clients = [] } = useQuery({
    queryKey: ['pipelineClients', normalizedInterests.length],
    queryFn: async () => {
      if (normalizedInterests.length === 0) return [];
      const clientIds = [...new Set(normalizedInterests.map(i => i.clientId).filter(Boolean))];
      if (clientIds.length === 0) return [];
      return base44.entities.Client.filter({ id: { $in: clientIds } });
    },
    enabled: normalizedInterests.length > 0,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-pipeline'],
    queryFn: () => base44.entities.User.list(),
    enabled: normalizedInterests.length > 0,
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
    queryKey: ['pipelineActivities', user?.id, accessibleIds],
    queryFn: async () => {
      let all;
      if (accessibleIds === null) {
        all = await base44.entities.Activity.list('-created_date', 500);
      } else if (accessibleIds.length === 0) {
        return [];
      } else {
        all = await base44.entities.Activity.filter({ projectId: { $in: accessibleIds }, status: { $ne: 'cancelled' } });
      }
      // Last completed/done activity per client
      const lastByClient = {};
      all.filter(a => a.status !== 'cancelled').forEach(a => {
        const key = a.clientId;
        if (!lastByClient[key] || new Date(a.created_date) > new Date(lastByClient[key].created_date)) {
          lastByClient[key] = a;
        }
      });
      return Object.values(lastByClient);
    },
    enabled: accessibleIds !== undefined && !!user?.id,
  });

  // Enrich interests
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const enrichedInterests = normalizedInterests.map(i => ({
    ...i,
    fullName: clientMap[i.clientId]?.fullName || '—',
    managerName: userMap[i.assignedManagerUserId]?.full_name || null,
  }));

  // Mutations
  const updateInterest = useMutation({
    mutationFn: (data) => base44.entities.ClientProjectInterest.update(data.id, data.updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipelineInterests'] }),
  });

  const createActivity = useMutation({
    mutationFn: (data) => base44.entities.Activity.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipelineActivities'] }),
  });

  const isSaving = updateInterest.isPending || createActivity.isPending;

  const handleCall = async (interest, { comment, newStage, callStartedAt }) => {
    // 1. Save activity — startedAt = when call button was tapped, completedAt = now
    const now = new Date().toISOString();
    const activityData = {
      clientId: interest.clientId,
      projectId: interest.projectId,
      interestId: interest.id,
      type: 'call',
      status: 'done',
      startedAt: callStartedAt || now,
      completedAt: now,
      scheduledAt: callStartedAt || now,
      createdByUserId: user?.id,
    };
    if (comment) activityData.notes = comment;
    await createActivity.mutateAsync(activityData);

    // 2. If stage change requested — update stage
    if (newStage) {
      await updateInterest.mutateAsync({
        id: interest.id,
        updates: {
          pipelineStage: newStage,
          stageUpdatedAt: new Date().toISOString(),
          lastInteractionAt: new Date().toISOString(),
        },
      });
      toast.success('Skambutis išsaugotas, etapas pakeistas');
    } else {
      await updateInterest.mutateAsync({
        id: interest.id,
        updates: { lastInteractionAt: new Date().toISOString() },
      });
      toast.success('Skambutis išsaugotas');
    }
  };

  const handleStageChange = async (interest, { newStage, comment }) => {
    // Save audit activity (comment optional)
    const activityData = {
      clientId: interest.clientId,
      projectId: interest.projectId,
      interestId: interest.id,
      type: 'other',
      status: 'done',
      completedAt: new Date().toISOString(),
      scheduledAt: new Date().toISOString(),
      createdByUserId: user?.id,
    };
    if (comment) activityData.notes = `Etapas pakeistas → ${comment}`;
    await createActivity.mutateAsync(activityData);

    // Update stage only after activity saved
    await updateInterest.mutateAsync({
      id: interest.id,
      updates: {
        pipelineStage: newStage,
        stageUpdatedAt: new Date().toISOString(),
        lastInteractionAt: new Date().toISOString(),
      },
    });
    toast.success('Etapas pakeistas');
  };

  // Summary stats
  const overdueCount = enrichedInterests.filter(isInterestOverdue).length;
  const activeStages = ['new_contact', 'no_answer_1', 'no_answer_2', 'no_answer_3', 'proposal_sent', 'consultation_booked', 'viewing_booked', 'waiting_response', 'follow_up', 'negotiation'];
  const activeCount = enrichedInterests.filter(i => activeStages.includes(i.pipelineStage)).length;
  const newCount = enrichedInterests.filter(i => i.pipelineStage === 'new_contact').length;
  const reservationCount = enrichedInterests.filter(i => i.pipelineStage === 'reservation').length;

  if (!canAccess) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos prie pardavimų kanalo</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pardavimų kanalas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {enrichedInterests.length === 1
            ? '1 klientas'
            : enrichedInterests.length >= 2 && enrichedInterests.length <= 9
              ? `${enrichedInterests.length} klientai`
              : `${enrichedInterests.length} klientų`}
        </p>
      </div>

      {/* Operational summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nauji</p>
              <p className="text-lg font-bold">{newCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aktyvūs</p>
              <p className="text-lg font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${overdueCount > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
              <Clock className={`h-4 w-4 ${overdueCount > 0 ? 'text-red-700' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vėluoja</p>
              <p className={`text-lg font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>{overdueCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rezervacijos</p>
              <p className="text-lg font-bold">{reservationCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {overdueCount > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-700" />
          <AlertDescription className="text-red-700">
            {overdueCount === 1 ? '1 klientas reikalauja dėmesio' : `${overdueCount} klientai reikalauja dėmesio`} — vėluoja follow-up arba etapas per senas
          </AlertDescription>
        </Alert>
      )}

      {/* Kanban board — desktop columns / mobile stacked list */}
      {isMobile ? (
        <PipelineMobileView
          interests={enrichedInterests}
          projects={projects}
          units={units}
          activities={activities}
          onCall={handleCall}
          onStageChange={handleStageChange}
          saving={isSaving}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {PIPELINE_STAGES.map(stage => (
            <PipelineColumn
              key={stage}
              stage={stage}
              interests={enrichedInterests}
              projects={projects}
              units={units}
              activities={activities}
              onCall={handleCall}
              onStageChange={handleStageChange}
              saving={isSaving}
            />
          ))}
        </div>
      )}
    </div>
  );
}