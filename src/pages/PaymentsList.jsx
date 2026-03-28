import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { getAccessibleProjectIds } from '@/lib/queryAccess';

export default function PaymentsList() {
  const context = useOutletContext() || {};
  const { user } = context;
  const [filters, setFilters] = useState({ search: '', project: 'all' });

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

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.Payment.list('-created_date', 100);
      return base44.entities.Payment.filter({ projectId: { $in: accessibleIds } });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 200),
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = payments.filter(p => {
    if (filters.search && !clientMap[p.clientId]?.fullName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.project !== 'all' && p.projectId !== filters.project) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mokėjimai</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} mokėjimas (-ų)</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ieškoti pagal kliento vardą..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={filters.project} onValueChange={v => setFilters(prev => ({ ...prev, project: v }))}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card">
            <SelectValue placeholder="Visi projektai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi projektai</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-20">
            <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Nėra mokėjimų</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(payment => {
            const client = clientMap[payment.clientId];
            const project = projectMap[payment.projectId];

            return (
              <Card key={payment.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{client?.fullName}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground">{project?.projectName}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <Badge variant="outline" className="text-[11px]">
                          {payment.paymentType === 'advance' ? 'Avansas' : 'Kita'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm font-medium">
                        €{payment.amount.toFixed(2)}
                        <span className="text-xs text-muted-foreground">
                          · {format(new Date(payment.paidAt), 'yyyy-MM-dd')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}