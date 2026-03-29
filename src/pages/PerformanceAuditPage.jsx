import React, { useState } from 'react';
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Gauge, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';

const STATUS_CFG = {
  ok:       { icon: CheckCircle2, color: 'text-green-600', bg: 'border-green-200 bg-green-50', badge: 'bg-green-100 text-green-800' },
  warning:  { icon: AlertTriangle, color: 'text-yellow-600', bg: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800' },
  critical: { icon: XCircle, color: 'text-destructive', bg: 'border-red-200 bg-red-50', badge: 'bg-red-100 text-red-800' },
};

const CHECK_LABELS = {
  query_latency: 'Query latency',
  entity_size: 'Entity dydžiai',
  log_accumulation: 'Log kaupimasis',
  stale_events: 'Neapdoroti eventai',
};

function LatencyBar({ ms }) {
  const pct = Math.min(100, (ms / 5000) * 100);
  const color = ms > 4000 ? 'bg-red-400' : ms > 2000 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-12 text-right">{ms}ms</span>
    </div>
  );
}

export default function PerformanceAuditPage() {
  const [result, setResult] = useState(null);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const runMutation = useMutation({
    mutationFn: () => base44.functions.invoke('runPerformanceAudit', {}),
    onSuccess: (res) => {
      setResult(res.data);
      toast.success('Našumo auditas baigtas');
    },
    onError: () => toast.error('Auditas nepavyko')
  });

  const checks = result?.checks || [];
  const latencyCheck = checks.find(c => c.name === 'query_latency');
  const otherChecks = checks.filter(c => c.name !== 'query_latency');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gauge className="h-6 w-6" />Našumo auditas</h1>
          <p className="text-muted-foreground text-sm">Query latency, entity dydžiai, log kaupimasis</p>
        </div>
        {isAdmin && (
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
            {runMutation.isPending ? 'Matuojama...' : 'Vykdyti auditą'}
          </Button>
        )}
      </div>

      {!result && !runMutation.isPending && (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          <Gauge className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p>Spauskite "Vykdyti auditą" — matuoja realų query greitį</p>
        </CardContent></Card>
      )}

      {runMutation.isPending && (
        <Card><CardContent className="pt-12 pb-12 text-center">
          <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
          <p className="text-sm text-muted-foreground">Matuojamas sistemos greitis...</p>
        </CardContent></Card>
      )}

      {/* Query latency section */}
      {latencyCheck && (
        <Card className={`border ${STATUS_CFG[latencyCheck.status]?.bg || ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Query latency
              <Badge className={`ml-auto ${STATUS_CFG[latencyCheck.status]?.badge}`}>{latencyCheck.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{latencyCheck.message}</p>
            <div className="space-y-2">
              {(latencyCheck.items || []).map((q, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={q.rating === 'ok' ? 'text-foreground' : 'text-yellow-600 font-medium'}>{q.label}</span>
                    <Badge variant="outline" className="text-xs">{q.count} rows</Badge>
                  </div>
                  <LatencyBar ms={q.durationMs} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other checks */}
      {otherChecks.map(check => {
        const cfg = STATUS_CFG[check.status] || STATUS_CFG.ok;
        const Icon = cfg.icon;
        return (
          <Card key={check.name} className={`border ${cfg.bg}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`h-4 w-4 ${cfg.color}`} />
                {CHECK_LABELS[check.name] || check.name.replace(/_/g, ' ')}
                <Badge className={`ml-auto ${cfg.badge}`}>{check.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{check.message}</p>
              {(check.items || []).map((item, i) => (
                <div key={i} className="mt-2 text-xs text-muted-foreground bg-background rounded px-2 py-1 border">
                  {item.recommendation || item.issue || JSON.stringify(item)}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}