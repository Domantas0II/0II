import React, { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, Plus, X, Folder, Home, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format, isPast } from 'date-fns';
import { canAccessInbound, normalizeRole } from '@/lib/constants';
import { getAccessibleProjectIds, filterByAccessibleProjects } from '@/lib/queryAccess';
import ActivityRow from '@/components/pipeline/ActivityRow';
import ActivityForm from '@/components/pipeline/ActivityForm';

const INTEREST_STATUS_LABELS = {
  new_interest: 'Naujas',
  contacted: 'Susisiekta',
  considering: 'Svarsto',
  follow_up: 'Sekantis follow-up',
  reserved: 'Rezervuota',
  completed: 'Baigta',
  rejected: 'Atmesta',
};

const INTEREST_STATUS_COLORS = {
  new_interest: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  considering: 'bg-purple-50 text-purple-700 border-purple-200',
  follow_up: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  reserved: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export default function ClientDetail() {
  const { user } = useOutletContext();
  const { id: clientId } = useParams();
  const queryClient = useQueryClient();
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const canAccess = canAccessInbound(normalizeRole(user?.role));
  if (!canAccess) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos</div>;
  }

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => base44.entities.Client.filter({ id: clientId }).then(r => r?.[0]),
    enabled: !!clientId,
  });

  const { data: projectInterests = [] } = useQuery({
    queryKey: ['projectInterests', clientId],
    queryFn: () => base44.entities.ClientProjectInterest.filter({ clientId }),
    enabled: !!clientId,
  });

  const { data: unitInterests = [] } = useQuery({
    queryKey: ['unitInterests', clientId],
    queryFn: () => base44.entities.ClientUnitInterest.filter({ clientId }),
    enabled: !!clientId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.Project.list('-created_date');
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.SaleUnit.list('-created_date');
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', clientId],
    queryFn: async () => {
      const all = await base44.entities.Activity.filter({ clientId });
      // Filter out orphan activities (missing or invalid projectId)
      return all.filter(a => {
        if (!a.projectId) return false;
        // accessibleIds === null means FULL ACCESS (admin)
        if (accessibleIds === null) return true;
        return accessibleIds.includes(a.projectId);
      });
    },
    enabled: !!clientId && accessibleIds !== undefined,
  });

  const updateInterest = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ClientProjectInterest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projectInterests', clientId] }),
  });

  const addUnitInterest = useMutation({
    mutationFn: (unitId) =>
      base44.entities.ClientUnitInterest.create({
        projectId: units.find(u => u.id === unitId)?.projectId,
        clientId,
        unitId,
        priorityOrder: (unitInterests.length || 0) + 1,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unitInterests', clientId] });
      setShowAddUnit(false);
      setSelectedUnitId('');
      toast.success('Objektas pridėtas');
    },
  });

  const removeUnitInterest = useMutation({
    mutationFn: (interestId) => base44.entities.ClientUnitInterest.delete(interestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['unitInterests', clientId] }),
  });

  const createActivity = useMutation({
    mutationFn: (data) => {
      // Server-side validation: enforce projectId, clientId, type
      if (!data.projectId) throw new Error('Projektai privalomas');
      if (!data.type) throw new Error('Veiklos tipas privalomas');
      if (!clientId) throw new Error('Kliento ID privalomas');
      
      return base44.entities.Activity.create({
        clientId,
        projectId: data.projectId,
        type: data.type,
        scheduledAt: data.scheduledAt,
        notes: data.notes,
        createdByUserId: user?.id,
        assignedToUserId: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', clientId] });
      toast.success('Veikla sukurta');
    },
    onError: (error) => {
      toast.error(error.message || 'Nepavyko sukurti veiklos');
    },
  });

  const markActivityDone = useMutation({
    mutationFn: (activityId) =>
      base44.entities.Activity.update(activityId, {
        status: 'done',
        completedAt: new Date().toISOString(),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities', clientId] }),
  });

  const cancelActivity = useMutation({
    mutationFn: (activityId) =>
      base44.entities.Activity.update(activityId, { status: 'cancelled' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activities', clientId] }),
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));
  const assignedUnitIds = new Set(unitInterests.map(ui => ui.unitId));
  const availableUnits = units.filter(u => !assignedUnitIds.has(u.id));

  if (!client) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Klientas nerastas</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/inquiry"><ArrowLeft className="h-4 w-4 mr-2" /> Grįžti</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="gap-2 -ml-3">
        <Link to="/inquiry"><ArrowLeft className="h-4 w-4" /> Užklausa</Link>
      </Button>

      {/* Hero Card */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{client.fullName}</h2>
            {client.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" /> {client.phone}
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" /> {client.email}
              </div>
            )}
            {client.notes && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">{client.notes}</p>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-3">
              Sukurtas: {format(new Date(client.created_date), 'yyyy-MM-dd HH:mm')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Interests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Projektų susidomėjimai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {projectInterests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nėra projektų</p>
          ) : (
            projectInterests.filter(interest => accessibleIds?.includes(interest.projectId)).map(interest => (
              <div key={interest.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Folder className="h-4 w-4" /> {projectMap[interest.projectId]?.projectName}
                  </p>
                  <Select
                    value={interest.status}
                    onValueChange={(status) =>
                      updateInterest.mutate({
                        id: interest.id,
                        data: { status, lastInteractionAt: new Date().toISOString() },
                      })
                    }
                  >
                    <SelectTrigger className="w-48 h-8 mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INTEREST_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className={`text-[11px] border ${INTEREST_STATUS_COLORS[interest.status] || ''}`}>
                  {INTEREST_STATUS_LABELS[interest.status]}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Unit Interests */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Objektų susidomėjimai</CardTitle>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowAddUnit(true)}>
            <Plus className="h-3.5 w-3.5" /> Objektas
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {unitInterests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nėra objektų</p>
          ) : (
            unitInterests.filter(interest => accessibleIds?.includes(interest.projectId)).map(interest => (
              <div key={interest.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Home className="h-4 w-4" /> {unitMap[interest.unitId]?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {projectMap[interest.projectId]?.projectName}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeUnitInterest.mutate(interest.id)}
                  disabled={removeUnitInterest.isPending}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Activities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Veiklos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const upcomingActivities = activities.filter(a => a.status === 'planned' && new Date(a.scheduledAt) > new Date());
            const overdue = projectInterests.length > 0 && projectInterests[0].nextFollowUpAt && isPast(new Date(projectInterests[0].nextFollowUpAt)) && upcomingActivities.length === 0;
            
            return overdue && (
              <Alert className="border-amber-200 bg-amber-50 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-700">
                  ⚠️ Reikia follow-up
                </AlertDescription>
              </Alert>
            );
          })()}

          <ActivityForm
            projectInterests={projectInterests}
            projects={projects}
            onSubmit={(data) => createActivity.mutate(data)}
            saving={createActivity.isPending}
          />

          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nėra veiklų</p>
          ) : (
            <div className="space-y-2">
              {activities.map(a => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  projectName={projectMap[a.projectId]?.projectName}
                  onMarkDone={markActivityDone.mutate}
                  onCancel={cancelActivity.mutate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Unit Interest Dialog */}
      <Dialog open={showAddUnit} onOpenChange={setShowAddUnit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pridėti objekto susidomėjimą</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
              <SelectTrigger>
                <SelectValue placeholder={availableUnits.length === 0 ? 'Visi objektai priskirti' : 'Pasirinkite objektą...'} />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label} ({projectMap[u.projectId]?.projectName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddUnit(false)} className="flex-1">
                Atšaukti
              </Button>
              <Button
                onClick={() => addUnitInterest.mutate(selectedUnitId)}
                disabled={!selectedUnitId || addUnitInterest.isPending}
                className="flex-1"
              >
                Pridėti
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}