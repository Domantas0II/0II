import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';
import ComponentRow from './ComponentRow';
import { COMPONENT_TYPE_LABELS } from '@/lib/unitConstants';

export default function AssignComponentModal({ open, onClose, unit }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedComponents, setSelectedComponents] = useState([]);

  const { data: poolComponents = [], isLoading } = useQuery({
    queryKey: ['components-pool', unit?.projectId],
    queryFn: () => 
      base44.entities.UnitComponent.filter({
        projectId: unit?.projectId,
        unitId: null,
      }),
    enabled: !!open && !!unit?.projectId,
  });

  const updateComponent = useMutation({
    mutationFn: async ({ compId, data }) => {
      // Validate before updating
      const validation = await base44.functions.invoke('validateComponentAssignment', {
        componentId: compId,
        unitId: unit.id,
      });
      
      if (!validation.data?.valid) {
        throw new Error(validation.data?.error || 'Validation failed');
      }

      return base44.entities.UnitComponent.update(compId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components-pool'] });
      queryClient.invalidateQueries({ queryKey: ['components', unit.id] });
      setSelectedComponents([]);
      toast.success('Dedamosios priskirtos');
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || 'Priskyrimas nepavyko');
    },
  });

  const filtered = poolComponents.filter(comp => {
    const matchSearch = comp.label.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || comp.type === typeFilter;
    const isAssignable = comp.status !== 'sold' && comp.status !== 'withheld';
    return matchSearch && matchType && isAssignable;
  });

  const handleToggleComponent = (compId) => {
    setSelectedComponents(prev =>
      prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
    );
  };

  const handleAssign = async () => {
    if (selectedComponents.length === 0) return;

    await Promise.all(
      selectedComponents.map(compId =>
        updateComponent.mutateAsync({
          compId,
          data: { unitId: unit.id },
        })
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Priskirti dedamosias iš baseino</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-3 pb-3 border-b">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Paieška pagal žymę..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Visų tipų" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Visų tipų</SelectItem>
                    {Object.entries(COMPONENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {filtered.length === 0 ? 'Nėra pasiekiamų dedamųjų' : `Rasta ${filtered.length} dedamųjų · Pasirinkta ${selectedComponents.length}`}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-3">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nėra pasiekiamų dedamųjų šiam projektui</p>
              ) : (
                filtered.map(comp => (
                  <div
                    key={comp.id}
                    onClick={() => handleToggleComponent(comp.id)}
                    className={`cursor-pointer transition-all p-3 rounded-lg border-2 ${
                      selectedComponents.includes(comp.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <ComponentRow component={comp} canManage={false} />
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3 justify-end border-t pt-4">
              <Button variant="outline" onClick={onClose}>Atšaukti</Button>
              <Button
                onClick={handleAssign}
                disabled={selectedComponents.length === 0 || updateComponent.isPending}
              >
                {updateComponent.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Priskirti ({selectedComponents.length})
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}