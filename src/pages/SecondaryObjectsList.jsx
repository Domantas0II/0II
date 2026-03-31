import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SecondaryObjectCard from '@/components/secondary/SecondaryObjectCard';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function SecondaryObjectsList() {
  const [filter, setFilter] = useState('all');

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: objects = [], isLoading } = useQuery({
    queryKey: ['secondary-objects'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getSecondaryPipelineObjects', {});
        return response.data?.data || [];
      } catch {
        return [];
      }
    }
  });

  const filteredObjects = objects.filter(obj => {
    if (filter === 'mine') return obj.assignedAgentUserId === currentUser?.id;
    if (filter === 'available') return obj.status === 'available';
    if (filter === 'reserved') return obj.status === 'reserved';
    if (filter === 'sold') return obj.status === 'sold';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">🏢 Antrinės rinkos objektai</h1>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Naujas objektas
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi objektai ({objects.length})</SelectItem>
            <SelectItem value="mine">Mano objektai ({objects.filter(o => o.assignedAgentUserId === currentUser?.id).length})</SelectItem>
            <SelectItem value="available">Laisvi ({objects.filter(o => o.status === 'available').length})</SelectItem>
            <SelectItem value="reserved">Rezervuoti ({objects.filter(o => o.status === 'reserved').length})</SelectItem>
            <SelectItem value="sold">Parduoti ({objects.filter(o => o.status === 'sold').length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : filteredObjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Objektų nerasta
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredObjects.map(obj => (
            <SecondaryObjectCard key={obj.id} object={obj} />
          ))}
        </div>
      )}
    </div>
  );
}