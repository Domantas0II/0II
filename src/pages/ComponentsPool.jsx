import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import ComponentRow from '@/components/units/ComponentRow';
import CreateComponentForm from '@/components/units/CreateComponentForm';
import { CAN_MANAGE_UNITS, COMPONENT_TYPE_LABELS, COMPONENT_STATUS_LABELS } from '@/lib/unitConstants';

export default function ComponentsPool() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ search: '', project: 'all', type: 'all', status: 'all' });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
  });

  const { data: allComponents = [], isLoading } = useQuery({
    queryKey: ['components-pool'],
    queryFn: () => base44.entities.UnitComponent.list('-created_date'),
  });

  // Pool = tik nepriskirti (unitId = null arba undefined)
  const poolComponents = allComponents.filter(c => !c.unitId);

  const createComponent = useMutation({
    mutationFn: (data) => base44.entities.UnitComponent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components-pool'] });
      setShowCreate(false);
      toast.success('Dedamoji sukurta');
    },
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const filtered = poolComponents.filter(c => {
    if (filters.search && !c.label.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.project !== 'all' && c.projectId !== filters.project) return false;
    if (filters.type !== 'all' && c.type !== filters.type) return false;
    if (filters.status !== 'all' && c.status !== filters.status) return false;
    return true;
  });

  const canManage = CAN_MANAGE_UNITS.includes(user?.role);

  const set = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dedamųjų pool</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} nepriskirtos dedamosios</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nauja dedamoji
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ieškoti pagal žymę..."
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={filters.project} onValueChange={v => set('project', v)}>
          <SelectTrigger className="w-full sm:w-[200px] bg-card">
            <SelectValue placeholder="Visi projektai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi projektai</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={v => set('type', v)}>
          <SelectTrigger className="w-full sm:w-[140px] bg-card">
            <SelectValue placeholder="Tipas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi tipai</SelectItem>
            {Object.entries(COMPONENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="w-full sm:w-[150px] bg-card">
            <SelectValue placeholder="Statusas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi statusai</SelectItem>
            {Object.entries(COMPONENT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-14 bg-card rounded-lg border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nėra laisvų dedamųjų</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="relative">
              <ComponentRow component={c} canManage={false} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="text-xs text-muted-foreground">{projectMap[c.projectId]?.projectName || c.projectId}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nauja dedamoji (pool)</DialogTitle>
          </DialogHeader>
          <CreateComponentForm
            projects={projects}
            onSubmit={(d) => createComponent.mutate(d)}
            onCancel={() => setShowCreate(false)}
            saving={createComponent.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}