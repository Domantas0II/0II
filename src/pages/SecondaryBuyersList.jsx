import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SecondaryBuyerCard from '@/components/secondary/SecondaryBuyerCard';
import { Plus, Filter } from 'lucide-react';

export default function SecondaryBuyersList() {
  const [filter, setFilter] = useState('all');

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: buyers = [], isLoading } = useQuery({
    queryKey: ['secondary-buyers'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getSecondaryPipelineBuyers', {});
        return response.data?.data || [];
      } catch {
        return [];
      }
    }
  });

  const filteredBuyers = buyers.filter(buyer => {
    if (filter === 'mine') return buyer.assignedAgentUserId === currentUser?.id;
    if (filter === 'active') return buyer.status === 'active';
    if (filter === 'paused') return buyer.status === 'paused';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">👥 Antrinės rinkos pirkėjai</h1>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Naujas pirkėjas
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi pirkėjai ({buyers.length})</SelectItem>
            <SelectItem value="mine">Mano pirkėjai ({buyers.filter(b => b.assignedAgentUserId === currentUser?.id).length})</SelectItem>
            <SelectItem value="active">Aktyvūs ({buyers.filter(b => b.status === 'active').length})</SelectItem>
            <SelectItem value="paused">Pauzėje ({buyers.filter(b => b.status === 'paused').length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : filteredBuyers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Pirkėjų nerasta
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBuyers.map(buyer => (
            <SecondaryBuyerCard key={buyer.id} buyer={buyer} />
          ))}
        </div>
      )}
    </div>
  );
}