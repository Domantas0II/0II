import React, { useState } from 'react';
import { useOutletContext, useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Settings, CheckCircle2, AlertTriangle, XCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  PROJECT_TYPE_LABELS, PROJECT_STAGE_LABELS,
  LIFECYCLE_LABELS, LIFECYCLE_COLORS,
  STRUCTURE_MODEL_LABELS,
  COMPONENT_LABELS, INSTALLATION_STATUS_LABELS, ENERGY_CLASS_LABELS
} from '@/lib/projectConstants';
import { UNIT_TYPE_LABELS } from '@/lib/unitConstants';
import { canSetInternalReady } from '@/lib/projectCompleteness';
import { canManageProjects } from '@/lib/constants';

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
    </div>
  );
}

export default function ProjectDetail() {
  const { user } = useOutletContext();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [hasAccess, setHasAccess] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const proj = await base44.entities.Project.filter({ id }).then(r => r?.[0]);
      if (proj && user?.id) {
        const { canAccessProject } = await import('@/lib/queryAccess');
        const access = await canAccessProject(user, proj.id, base44);
        setHasAccess(access);
        if (!access) throw new Error('Access denied');
      }
      return proj;
    },
    enabled: !!id && !!user?.id,
  });

  const { data: inventory } = useQuery({
    queryKey: ['projectInventory', id],
    queryFn: () => base44.entities.ProjectInventoryConfig.filter({ projectId: id }).then(r => r?.[0]),
    enabled: !!id,
  });

  const { data: components } = useQuery({
    queryKey: ['projectComponents', id],
    queryFn: () => base44.entities.ProjectComponentConfig.filter({ projectId: id }).then(r => r?.[0]),
    enabled: !!id,
  });

  const { data: technical } = useQuery({
    queryKey: ['projectTechnical', id],
    queryFn: () => base44.entities.ProjectTechnicalDefaults.filter({ projectId: id }).then(r => r?.[0]),
    enabled: !!id,
  });

  const { data: financial } = useQuery({
    queryKey: ['projectFinancial', id],
    queryFn: () => base44.entities.ProjectFinancialSettings.filter({ projectId: id }).then(r => r?.[0]),
    enabled: !!id,
  });

  const { data: completeness } = useQuery({
    queryKey: ['projectCompleteness', id],
    queryFn: () => base44.entities.ProjectCompleteness.filter({ projectId: id }).then(r => r?.[0]),
    enabled: !!id,
  });

  const updateProject = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Project.update(id, data);
      // Recalculate completeness after project update
      if (project && inventory && financial) {
        const { saveCompleteness } = await import('@/lib/projectCompleteness');
        await saveCompleteness(base44, id, project, inventory, null, null, financial, null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectCompleteness', id] });
    },
  });

  const handleLifecycleChange = (newState) => {
    if (newState === 'internal_ready') {
      const ok = canSetInternalReady(project, inventory, components, financial);
      if (!ok) {
        toast.error('Negalima: trūksta kritinių blokų (bazė, inventory, finansai)');
        return;
      }
    }
    updateProject.mutate({ projectLifecycleState: newState, updatedAt: new Date().toISOString() });
    toast.success('Būsena pakeista');
  };

  const canManage = canManageProjects(user?.role);
  const percent = completeness?.setupProgressPercent ?? 0;

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Projektas nerastas</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/projects"><ArrowLeft className="h-4 w-4 mr-2" />Grįžti</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="gap-2 -ml-3">
        <Link to="/projects"><ArrowLeft className="h-4 w-4" /> Projektai</Link>
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{project.projectName}</h2>
                <Badge variant="outline" className={cn('text-[11px] border', LIFECYCLE_COLORS[project.projectLifecycleState || 'draft'])}>
                  {LIFECYCLE_LABELS[project.projectLifecycleState || 'draft']}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">{project.projectCode}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {PROJECT_TYPE_LABELS[project.projectType]} · {PROJECT_STAGE_LABELS[project.projectStage]} · {project.city}, {project.district}
              </p>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <Select value={project.projectLifecycleState || 'draft'} onValueChange={handleLifecycleChange}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LIFECYCLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="mt-5 pt-5 border-t space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Setup užbaigtumas</p>
              <span className={cn(
                'text-sm font-bold',
                percent >= 80 ? 'text-green-600' : percent >= 50 ? 'text-amber-600' : 'text-destructive'
              )}>{percent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-amber-500' : 'bg-destructive')}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Inventory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Inventory modelis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inventory ? (
              <>
                <InfoRow label="Objektų tipai" value={inventory.unitTypesEnabled?.map(t => UNIT_TYPE_LABELS[t]).join(', ')} />
                <InfoRow label="Struktūra" value={STRUCTURE_MODEL_LABELS[inventory.structureModel]} />
              </>
            ) : <p className="text-sm text-muted-foreground">Nepildyta</p>}
          </CardContent>
        </Card>

        {/* Components */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Dedamosios</CardTitle>
          </CardHeader>
          <CardContent>
            {components ? (
              <InfoRow label="Aktyvios" value={components.componentsEnabled?.length > 0 ? components.componentsEnabled.map(c => COMPONENT_LABELS[c]).join(', ') : 'Nė viena'} />
            ) : <p className="text-sm text-muted-foreground">Nepildyta</p>}
          </CardContent>
        </Card>

        {/* Technical */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Techniniai default'ai</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {technical ? (
              <>
                <InfoRow label="Įrengimas" value={INSTALLATION_STATUS_LABELS[technical.installationStatus]} />
                <InfoRow label="Energetinė klasė" value={technical.energyClass} />
                <InfoRow label="Statybos metai" value={technical.constructionYear} />
              </>
            ) : <p className="text-sm text-muted-foreground">Nepildyta</p>}
          </CardContent>
        </Card>

        {/* Financial */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Finansai</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {financial ? (
              <>
                <InfoRow label="Įmonė" value={financial.developerCompanyName} />
                <InfoRow label="Komisinis" value={financial.commissionPercentDefault ? `${financial.commissionPercentDefault}%` : undefined} />
                <InfoRow label="Avansas" value={financial.advanceRequired && financial.advanceValue ? `${financial.advanceValue}${financial.advanceType === 'percent' ? '%' : '€'}` : 'Nereikalingas'} />
              </>
            ) : <p className="text-sm text-muted-foreground">Nepildyta</p>}
          </CardContent>
        </Card>
      </div>

      {/* Blockers */}
      {completeness?.criticalBlockersJson && JSON.parse(completeness.criticalBlockersJson || '[]').length > 0 && (
        <Card className="border-destructive/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Kritiniai blokai neužpildyti</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prieš perkeliant į &quot;Paruoštas viduje&quot; reikia užpildyti: {' '}
                  {JSON.parse(completeness.criticalBlockersJson).join(', ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}