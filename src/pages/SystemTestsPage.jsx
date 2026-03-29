import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FlaskConical, Play, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function SystemTestsPage() {
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['system-test-runs'],
    queryFn: () => base44.entities.SystemTestRun.list('-createdAt', 50)
  });

  const runMutation = useMutation({
    mutationFn: () => base44.functions.invoke('runSystemTests', {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['system-test-runs'] });
      const d = res.data;
      if (d.status === 'passed') {
        toast.success(`Visi ${d.passed} testai praėjo`);
      } else {
        toast.error(`${d.failed} testai nepraėjo iš ${d.passed + d.failed}`);
      }
    },
    onError: () => toast.error('Testai nepavyko')
  });

  const lastRun = runs[0];
  const lastResult = lastRun?.resultJson ? JSON.parse(lastRun.resultJson) : null;

  const passedRuns = runs.filter(r => r.status === 'passed').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FlaskConical className="h-6 w-6" />Sistemos testai</h1>
          <p className="text-muted-foreground text-sm">{runs.length} paleidimų istorijoje</p>
        </div>
        {isAdmin && (
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="gap-2">
            <Play className={`h-4 w-4 ${runMutation.isPending ? 'animate-pulse' : ''}`} />
            {runMutation.isPending ? 'Vykdoma...' : 'Vykdyti testus'}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Praėjo</p>
          <p className="text-2xl font-bold text-green-600">{passedRuns}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Nepraėjo</p>
          <p className="text-2xl font-bold text-destructive">{failedRuns}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">Paskutinis</p>
          <p className="text-sm font-bold mt-1">
            {lastRun ? new Date(lastRun.createdAt).toLocaleString('lt-LT') : '—'}
          </p>
        </CardContent></Card>
      </div>

      {/* Last run detail */}
      {lastResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {lastRun.status === 'passed'
                ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                : <XCircle className="h-5 w-5 text-destructive" />}
              Paskutinis paleidimas — {lastRun.status === 'passed' ? 'Praėjo' : 'Nepraėjo'}
              <span className="text-xs text-muted-foreground font-normal ml-2">
                <Clock className="h-3 w-3 inline mr-1" />{lastRun.durationMs}ms
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(lastResult.tests || []).map(test => (
                <div key={test.name} className="flex items-start justify-between gap-3 py-1.5 border-b last:border-0 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {test.status === 'passed'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        : <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      <span className="font-medium">{test.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">{test.detail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{test.durationMs}ms</span>
                    <Badge className={test.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {test.status === 'passed' ? 'Praėjo' : 'Nepraėjo'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run history */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : runs.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">Testai dar nebuvo vykdyti</CardContent></Card>
      ) : (
        <div>
          <h2 className="text-base font-semibold mb-3">Istorija</h2>
          <div className="space-y-2">
            {runs.slice(1, 20).map(run => {
              const res = run.resultJson ? JSON.parse(run.resultJson) : {};
              return (
                <Card key={run.id}>
                  <CardContent className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {run.status === 'passed'
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">{new Date(run.createdAt).toLocaleString('lt-LT')}</p>
                        <p className="text-xs text-muted-foreground">{res.passed || 0} praėjo · {res.failed || 0} nepraėjo · {run.durationMs}ms</p>
                      </div>
                    </div>
                    <Badge className={run.status === 'passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {run.status === 'passed' ? 'Praėjo' : 'Nepraėjo'}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}