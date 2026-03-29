import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileWarning, RefreshCw, CheckCircle } from 'lucide-react';

const SEV_COLORS = { critical: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-gray-100 text-gray-700' };

const ISSUE_LABELS = {
  RESERVATION_UNIT_MISMATCH: 'Rezervacija ≠ Unit statusas',
  DEAL_NO_COMMISSION: 'Deal be komisinių',
  COMMISSION_NO_DEAL: 'Komisiniai be Deal',
  PAYOUT_NO_ITEMS: 'Payout be eilučių',
  DUPLICATE_ACTIVE_RESERVATIONS: 'Dvigubos rezervacijos',
  PAYOUT_COMMISSION_MISMATCH: 'Payout / komisiniai neatitikimas',
};

export default function DataIntegrityPage() {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('false');

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['integrity-issues'],
    queryFn: () => base44.entities.DataIntegrityIssue.list('-detectedAt', 200)
  });

  const runMutation = useMutation({
    mutationFn: () => base44.functions.invoke('runDataIntegrityChecks', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['integrity-issues'] });
      toast.success(`Integrity check baigtas: ${res.data.issuesFound} naujų problemų`);
    },
    onError: () => toast.error('Integrity check nepavyko')
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.DataIntegrityIssue.update(id, { resolved: true, resolvedAt: new Date().toISOString(), resolvedByUserId: currentUser?.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrity-issues'] }); toast.success('Problema pažymėta išspręsta'); }
  });

  const filtered = issues.filter(i => {
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    if (resolvedFilter === 'false' && i.resolved) return false;
    if (resolvedFilter === 'true' && !i.resolved) return false;
    return true;
  });

  const unresolvedCritical = issues.filter(i => i.severity === 'critical' && !i.resolved).length;
  const unresolvedTotal = issues.filter(i => !i.resolved).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileWarning className="h-6 w-6" />Duomenų integrumas</h1>
          <p className="text-muted-foreground text-sm">{unresolvedTotal} neišspręstų problemų</p>
        </div>
        {isAdmin && (
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
            Tikrinti dabar
          </Button>
        )}
      </div>

      {unresolvedCritical > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 font-medium">
          ⚠ {unresolvedCritical} kritinių duomenų problemų reikalauja neatidėliotino dėmesio
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Neišspręstos</SelectItem>
            <SelectItem value="true">Išspręstos</SelectItem>
            <SelectItem value="all">Visos</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} problemų</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          {resolvedFilter === 'false' ? 'Nėra neišspręstų problemų ✓' : 'Problemų nerasta'}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(issue => (
            <Card key={issue.id} className={issue.resolved ? 'opacity-60' : ''}>
              <CardContent className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={SEV_COLORS[issue.severity]}>{issue.severity}</Badge>
                    <span className="font-medium text-sm">{ISSUE_LABELS[issue.issueType] || issue.issueType}</span>
                    <Badge variant="outline" className="text-xs">{issue.entityType} #{issue.entityId?.slice(-6)}</Badge>
                    {issue.resolved && <Badge className="bg-green-100 text-green-800 text-xs">Išspręsta</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(issue.detectedAt).toLocaleString('lt-LT')}</p>
                </div>
                {isAdmin && !issue.resolved && (
                  <Button size="sm" variant="outline" onClick={() => resolveMutation.mutate(issue.id)} className="gap-1 shrink-0">
                    <CheckCircle className="h-3 w-3" />Išspręsta
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}