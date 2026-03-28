import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { getAccessibleProjectIds } from '@/lib/queryAccess';

const AGREEMENT_TYPE_LABELS = {
  reservation: 'Rezervacijos',
  preliminary: 'Preliminari'
};

const AGREEMENT_STATUS_COLORS = {
  draft: 'border-yellow-300 text-yellow-700',
  signed: 'border-green-300 text-green-700',
  cancelled: 'border-red-300 text-red-700'
};

export default function AgreementsList() {
  const context = useOutletContext() || {};
  const { user } = context;
  const [filters, setFilters] = useState({ search: '', project: 'all', status: 'all' });

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

  const { data: agreements = [] } = useQuery({
    queryKey: ['agreements', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.Agreement.list('-created_date', 100);
      return base44.entities.Agreement.filter({ projectId: { $in: accessibleIds } });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 200),
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = agreements.filter(a => {
    if (filters.search && !clientMap[a.clientId]?.fullName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.project !== 'all' && a.projectId !== filters.project) return false;
    if (filters.status !== 'all' && a.status !== filters.status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sutartys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} sutartis</p>
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
        <Select value={filters.status} onValueChange={v => setFilters(prev => ({ ...prev, status: v }))}>
          <SelectTrigger className="w-full sm:w-[140px] bg-card">
            <SelectValue placeholder="Statusas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi statusai</SelectItem>
            <SelectItem value="draft">Juodraštis</SelectItem>
            <SelectItem value="signed">Pasirašyta</SelectItem>
            <SelectItem value="cancelled">Atšaukta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-20">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Nėra sutarčių</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(agreement => {
            const client = clientMap[agreement.clientId];
            const project = projectMap[agreement.projectId];

            return (
              <Card key={agreement.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{client?.fullName}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground">{project?.projectName}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <Badge variant="outline" className="text-[11px]">
                          {AGREEMENT_TYPE_LABELS[agreement.agreementType]}
                        </Badge>
                        <Badge variant="outline" className={`text-[11px] border ${AGREEMENT_STATUS_COLORS[agreement.status]}`}>
                          {agreement.status === 'draft' ? 'Juodraštis' : agreement.status === 'signed' ? 'Pasirašyta' : 'Atšaukta'}
                        </Badge>
                      </div>
                      {agreement.signedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Pasirašyta: {format(new Date(agreement.signedAt), 'yyyy-MM-dd')}
                        </p>
                      )}
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