import React, { useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import UnitStatusBadge from '@/components/units/UnitStatusBadge';
import ComponentRow from '@/components/units/ComponentRow';
import CreateComponentForm from '@/components/units/CreateComponentForm';
import AssignComponentModal from '@/components/units/AssignComponentModal';
import {
  UNIT_TYPE_LABELS, UNIT_STATUS_LABELS,
  WINDOW_DIRECTION_LABELS
} from '@/lib/unitConstants';
import { canManageUnits } from '@/lib/constants';
import {
  INSTALLATION_STATUS_LABELS, ENERGY_CLASS_LABELS
} from '@/lib/projectConstants';

function InfoRow({ label, value }) {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value === true ? 'Taip' : value === false ? 'Ne' : value}</p>
    </div>
  );
}

function CollapsibleBlock({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button className="w-full" onClick={() => setOpen(o => !o)}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function UnitDetail() {
  const { user } = useOutletContext();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showAssignComponent, setShowAssignComponent] = useState(false);

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: () => base44.entities.SaleUnit.list(),
  });
  const unit = units.find(u => u.id === id);

  const { data: project } = useQuery({
    queryKey: ['project', unit?.projectId],
    queryFn: () => base44.entities.Project.filter({ id: unit.projectId }).then(r => r?.[0]),
    enabled: !!unit?.projectId,
  });

  const { data: components = [] } = useQuery({
    queryKey: ['components', id],
    queryFn: () => base44.entities.UnitComponent.filter({ unitId: id, projectId: unit?.projectId }),
    enabled: !!id && !!unit?.projectId,
  });

  const updateUnit = useMutation({
    mutationFn: (data) => base44.entities.SaleUnit.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units'] }),
  });

  const createComponent = useMutation({
    mutationFn: (data) => base44.entities.UnitComponent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', id] });
      setShowAddComponent(false);
      toast.success('Dedamoji pridėta');
    },
  });

  const updateComponent = useMutation({
    mutationFn: ({ compId, data }) => base44.entities.UnitComponent.update(compId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['components', id] }),
  });

  const handleStatusChange = (newStatus) => {
    updateUnit.mutate({ internalStatus: newStatus });
    toast.success('Statusas pakeistas');
  };

  const handleDetachComponent = (comp) => {
    // Grąžinti į pool: unitId = null
    updateComponent.mutate({ compId: comp.id, data: { unitId: null } });
    queryClient.invalidateQueries({ queryKey: ['components-pool'] });
    toast.success('Dedamoji grąžinta į pool');
  };

  const handleAddComponent = (data) => {
    // Enforce project isolation
    if (data.projectId !== unit.projectId) {
      toast.error('Negalima priskirti kito projekto dedamosios');
      return;
    }
    createComponent.mutate({ ...data, unitId: id });
  };

  const canManage = canManageUnits(user?.role);

  if (!unit) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Objektas nerastas</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/units"><ArrowLeft className="h-4 w-4 mr-2" />Grįžti</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="gap-2 -ml-3">
        <Link to="/units"><ArrowLeft className="h-4 w-4" />Objektai</Link>
      </Button>

      {/* Hero card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Visual placeholder */}
            <div className="w-full sm:w-32 h-24 sm:h-24 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-4xl">
              {unit.type === 'apartment' ? '🏢' : unit.type === 'house' ? '🏡' : '🏘️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{unit.label}</h2>
                <UnitStatusBadge status={unit.internalStatus} />
                {unit.isPublic && <Badge variant="outline" className="text-[10px]">Viešas</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {UNIT_TYPE_LABELS[unit.type]} · {project?.projectName || unit.projectId}
              </p>
              <div className="flex items-end gap-4 mt-2">
                <div>
                  <p className="text-2xl font-bold">{unit.price?.toLocaleString('lt-LT')} €</p>
                  <p className="text-xs text-muted-foreground">{unit.pricePerM2?.toLocaleString('lt-LT')} €/m²</p>
                </div>
                <p className="text-sm text-muted-foreground pb-1">{unit.areaM2} m²</p>
              </div>
            </div>
            {canManage && (
              <Select value={unit.internalStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-44 flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UNIT_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main info */}
      <CollapsibleBlock title="Pagrindinė informacija">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoRow label="Kambariai" value={unit.roomsCount} />
          <InfoRow label="Vonios" value={unit.bathroomsCount} />
          {unit.floor && <InfoRow label="Aukštas" value={`${unit.floor}${unit.totalFloors ? '/' + unit.totalFloors : ''}`} />}
          {unit.floorsCount && <InfoRow label="Aukštų" value={unit.floorsCount} />}
          {unit.buildingName && <InfoRow label="Korpusas" value={unit.buildingName} />}
          {unit.sectionName && <InfoRow label="Sekcija" value={unit.sectionName} />}
          {unit.phaseName && <InfoRow label="Etapas" value={unit.phaseName} />}
        </div>
      </CollapsibleBlock>

      {/* Technical */}
      <CollapsibleBlock title="Techniniai parametrai" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Įrengimas" value={INSTALLATION_STATUS_LABELS[unit.installationStatus]} />
          <InfoRow label="Energetinė klasė" value={unit.energyClass} />
          <InfoRow label="Statybos metai" value={unit.constructionYear} />
          <InfoRow label="Balkonas" value={unit.hasBalcony} />
          {unit.hasBalcony && unit.balconyAreaM2 && <InfoRow label="Balkono plotas" value={`${unit.balconyAreaM2} m²`} />}
          <InfoRow label="Terasa" value={unit.hasTerrace} />
          {unit.hasTerrace && unit.terraceAreaM2 && <InfoRow label="Terasos plotas" value={`${unit.terraceAreaM2} m²`} />}
          {unit.windowDirections?.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Langų kryptys</p>
              <p className="text-sm font-medium mt-0.5">
                {unit.windowDirections.map(d => WINDOW_DIRECTION_LABELS[d]).join(', ')}
              </p>
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* Components */}
      <CollapsibleBlock title={`Dedamosios (${components.length})`}>
        <div className="space-y-2">
          {components.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nėra priskirtų dedamųjų</p>
          ) : (
            components.map(c => (
              <ComponentRow
                key={c.id}
                component={c}
                canManage={canManage}
                onDetach={handleDetachComponent}
              />
            ))
          )}
          {canManage && (
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAssignComponent(true)}>
                <Link2 className="h-3.5 w-3.5" /> Priskirti iš pool
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddComponent(true)}>
                <Plus className="h-3.5 w-3.5" /> Kurti naują
              </Button>
            </div>
          )}
        </div>
      </CollapsibleBlock>

      {/* Comments */}
      {(unit.publicComment || unit.internalNotes) && (
        <CollapsibleBlock title="Komentarai" defaultOpen={false}>
          <div className="space-y-3">
            {unit.publicComment && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Viešas komentaras</p>
                <p className="text-sm">{unit.publicComment}</p>
              </div>
            )}
            {unit.internalNotes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Vidinės pastabos</p>
                <p className="text-sm">{unit.internalNotes}</p>
              </div>
            )}
          </div>
        </CollapsibleBlock>
      )}

      {/* Assign from pool */}
      <AssignComponentModal
        open={showAssignComponent}
        onClose={() => setShowAssignComponent(false)}
        unit={unit}
      />

      {/* Add component dialog */}
      <Dialog open={showAddComponent} onOpenChange={setShowAddComponent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pridėti dedamąją</DialogTitle>
          </DialogHeader>
          <CreateComponentForm
            projectId={unit.projectId}
            onSubmit={handleAddComponent}
            onCancel={() => setShowAddComponent(false)}
            saving={createComponent.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}