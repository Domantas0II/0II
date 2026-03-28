import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  COMPONENT_TYPE_LABELS, COMPONENT_STATUS_LABELS
} from '@/lib/unitConstants';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  available: 'bg-green-50 text-green-700 border-green-200',
  reserved: 'bg-amber-50 text-amber-700 border-amber-200',
  sold: 'bg-slate-100 text-slate-500 border-slate-200',
  withheld: 'bg-orange-50 text-orange-700 border-orange-200',
};

export default function AssignComponentModal({ open, onClose, unit }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: allComponents = [] } = useQuery({
    queryKey: ['components-pool'],
    queryFn: () => base44.entities.UnitComponent.list('-created_date'),
    enabled: open,
  });

  // Pool = nepriskirti, to paties projekto
  const pool = allComponents.filter(c =>
    !c.unitId && c.projectId === unit?.projectId
  );

  const filtered = pool.filter(c => {
    if (search && !c.label.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    return true;
  });

  const assign = useMutation({
    mutationFn: (compId) => base44.entities.UnitComponent.update(compId, { unitId: unit.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components-pool'] });
      queryClient.invalidateQueries({ queryKey: ['components', unit.id] });
      toast.success('Dedamoji priskirta');
      onClose();
    },
  });

  const handleAssign = (comp) => {
    if (comp.status === 'sold') {
      toast.error('Negalima priskirti parduotos dedamosios');
      return;
    }
    if (comp.projectId !== unit.projectId) {
      toast.error('Negalima priskirti kito projekto dedamosios');
      return;
    }
    assign.mutate(comp.id);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Priskirti dedamąją iš pool</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Ieškoti..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="Tipas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Visi tipai</SelectItem>
              {Object.entries(COMPONENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-3 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nėra laisvų dedamųjų šiame projekte
            </p>
          ) : (
            filtered.map(comp => (
              <div
                key={comp.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border bg-card',
                  comp.status === 'sold' && 'opacity-50'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{comp.label}</span>
                    <Badge variant="outline" className="text-[10px]">{COMPONENT_TYPE_LABELS[comp.type]}</Badge>
                    <Badge variant="outline" className={cn('text-[10px] border', STATUS_COLORS[comp.status] || '')}>
                      {COMPONENT_STATUS_LABELS[comp.status]}
                    </Badge>
                    {!comp.includedInPrice && comp.price && (
                      <span className="text-[10px] font-medium">{comp.price.toLocaleString('lt-LT')} €</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs flex-shrink-0"
                  disabled={comp.status === 'sold' || assign.isPending}
                  onClick={() => handleAssign(comp)}
                >
                  <LinkIcon className="h-3 w-3" /> Priskirti
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}