import React, { useState } from 'react';
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Rocket, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

const STATUS_CFG = {
  ok:       { icon: CheckCircle2, color: 'text-green-600', badge: 'bg-green-100 text-green-800' },
  warning:  { icon: AlertTriangle, color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-800' },
  critical: { icon: XCircle, color: 'text-destructive', badge: 'bg-red-100 text-red-800' },
};

const CATEGORY_LABELS = { infrastructure: 'Infrastruktūra', data: 'Duomenys', configuration: 'Konfigūracija', security: 'Saugumas', operations: 'Operacijos' };

function ChecklistItem({ item }) {
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.ok;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 py-3 border-b last:border-0 ${item.deployBlocker && item.status === 'critical' ? 'bg-red-50/50 -mx-2 px-2 rounded' : ''}`}>
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{item.label}</span>
          {item.deployBlocker && item.status !== 'ok' && (
            <Badge className="bg-red-100 text-red-800 text-xs">DEPLOY BLOCKER</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>
      </div>
      <Badge className={cfg.badge}>{item.status === 'ok' ? '✓' : item.status}</Badge>
    </div>
  );
}

export default function ReleaseChecklistPage() {
  const [result, setResult] = useState(null);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const runMutation = useMutation({
    mutationFn: () => base44.functions.invoke('getReleaseChecklist', {}),
    onSuccess: (res) => {
      setResult(res.data);
      if (res.data.deployReady) toast.success('Sistema paruošta paleidimui!');
      else toast.error(`${res.data.summary?.deployBlockers} deploy blocker(ų) rasta`);
    },
    onError: () => toast.error('Checklist nepavyko')
  });

  const categories = result ? [...new Set(result.items.map(i => i.category))] : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Rocket className="h-6 w-6" />Release Checklist</h1>
          <p className="text-muted-foreground text-sm">Pilna sistema paruoštumo patikra prieš paleidimą</p>
        </div>
        {isAdmin && (
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
            {runMutation.isPending ? 'Tikrinama...' : 'Vykdyti checklistą'}
          </Button>
        )}
      </div>

      {!result && !runMutation.isPending && (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          <Rocket className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Spauskite "Vykdyti checklistą" prieš deploy</p>
        </CardContent></Card>
      )}

      {runMutation.isPending && (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-40" />
          <p>Tikrinama sistema...</p>
        </CardContent></Card>
      )}

      {result && (
        <>
          {/* Deploy readiness banner */}
          <div className={`rounded-xl border p-5 flex items-center gap-4 ${result.deployReady ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {result.deployReady
              ? <CheckCircle2 className="h-10 w-10 text-green-600 shrink-0" />
              : <ShieldAlert className="h-10 w-10 text-destructive shrink-0" />}
            <div>
              <p className={`text-lg font-bold ${result.deployReady ? 'text-green-700' : 'text-destructive'}`}>
                {result.deployReady ? 'Sistema paruošta paleidimui' : 'PALEIDIMAS BLOKUOTAS'}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {result.summary.ok} OK · {result.summary.warning} perspėjimų · {result.summary.critical} kritinių · {result.summary.deployBlockers} blokų
              </p>
              {result.blockers?.length > 0 && (
                <p className="text-xs text-destructive mt-1">Blokeriai: {result.blockers.join(' · ')}</p>
              )}
            </div>
          </div>

          {/* Items by category */}
          {categories.map(cat => {
            const catItems = result.items.filter(i => i.category === cat);
            return (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{CATEGORY_LABELS[cat] || cat}</CardTitle>
                </CardHeader>
                <CardContent>
                  {catItems.map(item => <ChecklistItem key={item.id} item={item} />)}
                </CardContent>
              </Card>
            );
          })}

          <p className="text-xs text-muted-foreground text-right">Sugeneruota: {new Date(result.generatedAt).toLocaleString('lt-LT')}</p>
        </>
      )}
    </div>
  );
}