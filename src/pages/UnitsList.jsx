import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Home, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import UnitCard from '@/components/units/UnitCard';
import UnitFilters from '@/components/units/UnitFilters';
import CreateUnitForm from '@/components/units/CreateUnitForm';
import { canManageUnits, normalizeRole } from '@/lib/constants';
import { getAccessibleProjectIds, filterByAccessibleProjects } from '@/lib/queryAccess';

export default function UnitsList() {
  const context = useOutletContext() || {};
  const { user } = context;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', project: 'all', type: 'all', status: 'all' });
  const [showCreate, setShowCreate] = useState(false);

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

  const { data: allUnits = [], isLoading } = useQuery({
    queryKey: ['units', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.SaleUnit.list('-created_date', 50);
      return base44.entities.SaleUnit.filter({ 
        projectId: { $in: accessibleIds } 
      });
    },
    enabled: accessibleIds !== undefined,
  });

  const units = allUnits;

  // Load technical defaults for accessible projects
  const { data: allTechnical = [] } = useQuery({
    queryKey: ['projectTechnicalAll', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.ProjectTechnicalDefaults.list();
      return base44.entities.ProjectTechnicalDefaults.filter({ 
        projectId: { $in: accessibleIds } 
      });
    },
    enabled: accessibleIds !== undefined,
  });
  const technicalByProject = Object.fromEntries(allTechnical.map(t => [t.projectId, t]));

  const updateUnit = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SaleUnit.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units'] }),
  });

  const createUnit = useMutation({
    mutationFn: (data) => base44.entities.SaleUnit.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setShowCreate(false);
      toast.success('Objektas sukurtas');
    },
  });

  const handleStatusChange = (unit, newStatus) => {
    updateUnit.mutate({ id: unit.id, data: { internalStatus: newStatus } });
    toast.success('Statusas pakeistas');
  };

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const filtered = units.filter(u => {
    if (filters.search && !u.label.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.project !== 'all' && u.projectId !== filters.project) return false;
    if (filters.type !== 'all' && u.type !== filters.type) return false;
    if (filters.status !== 'all' && u.internalStatus !== filters.status) return false;
    if (filters.public !== 'all') {
      const isPublic = u.isPublic === true;
      if (filters.public === 'true' && !isPublic) return false;
      if (filters.public === 'false' && isPublic) return false;
    }
    return true;
  });

  const canManage = canManageUnits(normalizeRole(user?.role));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Objektai</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} objektai</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Naujas objektas
          </Button>
        )}
      </div>

      <UnitFilters filters={filters} onChange={setFilters} projects={projects} />

      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-card rounded-xl border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Home className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nėra objektų</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => (
            <UnitCard
              key={u.id}
              unit={u}
              projectName={projectMap[u.projectId]?.projectName}
              currentUser={user}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Naujas pardavimo objektas</DialogTitle>
          </DialogHeader>
          <CreateUnitForm
            projects={projects}
            technicalDefaults={technicalByProject}
            onSubmit={(d) => createUnit.mutate({ ...d, createdByUserId: user?.id })}
            onCancel={() => setShowCreate(false)}
            saving={createUnit.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}