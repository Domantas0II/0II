import React, { useState } from 'react';
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ClipboardCheck, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_CFG = {
  ok:       { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800' },
  warning:  { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800' },
  critical: { icon: XCircle, color: 'text-destructive', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800' },
};

function SectionCard({ section }) {
  const [expanded, setExpanded] = useState(section.status !== 'ok');
  const cfg = STATUS_CFG[section.status] || STATUS_CFG.ok;
  const Icon = cfg.icon;
  const findings = section.findings || [];

  return (
    <Card className={`border ${cfg.bg}`}>
      <CardContent className="pt-4 pb-4">
        <button className="w-full flex items-center justify-between gap-3" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-3 min-w-0">
            <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
            <div className="text-left min-w-0">
              <p className="font-medium text-sm">{section.name.replace(/_/g, ' ')}</p>
              <p className="text-xs text-muted-foreground">{section.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {findings.length > 0 && <Badge variant="outline" className="text-xs">{findings.length} findings</Badge>}
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>
        {expanded && findings.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1">
            {findings.slice(0, 10).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs py-1">
                <Badge className={f.severity === 'critical' ? 'bg-red-100 text-red-800' : f.severity === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'}>
                  {f.severity || 'info'}
                </Badge>
                <span className="text-muted-foreground break-all">{f.type}{f.id ? ` — #${f.id.slice(-6)}` : ''}{f.ref ? ` → ref #${f.ref.slice(-6)}` : ''}</span>
              </div>
            ))}
            {findings.length > 10 && <p className="text-xs text-muted-foreground">+{findings.length - 10} more findings</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditTab({ label, fn, payload = {} }) {
  const [result, setResult] = useState(null);
  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke(fn, payload),
    onSuccess: (res) => { setResult(res.data); toast.success(`${label} baigtas`); },
    onError: () => toast.error(`${label} nepavyko`)
  });

  const checks = result?.checks || result?.sections || [];
  const criticalCount = checks.filter(c => c.status === 'critical').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {result && <>
            <Badge className="bg-green-100 text-green-800">{checks.filter(c => c.status === 'ok').length} OK</Badge>
            {warningCount > 0 && <Badge className="bg-yellow-100 text-yellow-800">{warningCount} Warning</Badge>}
            {criticalCount > 0 && <Badge className="bg-red-100 text-red-800">{criticalCount} Critical</Badge>}
          </>}
        </div>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${mutation.isPending ? 'animate-spin' : ''}`} />
          {mutation.isPending ? 'Vykdoma...' : 'Vykdyti'}
        </Button>
      </div>

      {!result && !mutation.isPending && (
        <Card><CardContent className="pt-8 pb-8 text-center text-muted-foreground text-sm">Spauskite "Vykdyti" norėdami atlikti auditą</CardContent></Card>
      )}
      {mutation.isPending && (
        <Card><CardContent className="pt-8 pb-8 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" /><p className="text-sm">Vykdoma...</p>
        </CardContent></Card>
      )}
      {result && checks.map((s, i) => <SectionCard key={i} section={s} />)}
    </div>
  );
}

export default function SystemAuditDashboard() {
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  if (!isAdmin) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">Tik administratoriams</div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="h-6 w-6" />System Audit</h1>
        <p className="text-muted-foreground text-sm">Visų modulių audito centras</p>
      </div>

      <Tabs defaultValue="full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="full">Pilnas auditas</TabsTrigger>
          <TabsTrigger value="config">Konfigūracija</TabsTrigger>
          <TabsTrigger value="security">Saugumas</TabsTrigger>
          <TabsTrigger value="performance">Našumas</TabsTrigger>
          <TabsTrigger value="e2e">E2E simuliacija</TabsTrigger>
        </TabsList>

        <TabsContent value="full">
          <AuditTab label="Pilnas sistemos auditas" fn="runFullSystemAudit" />
        </TabsContent>
        <TabsContent value="config">
          <AuditTab label="Konfigūracijos validacija" fn="validateSystemConfiguration" />
        </TabsContent>
        <TabsContent value="security">
          <AuditTab label="Saugumo auditas" fn="runSecurityAudit" />
        </TabsContent>
        <TabsContent value="performance">
          <AuditTab label="Našumo auditas" fn="runPerformanceAudit" />
        </TabsContent>
        <TabsContent value="e2e">
          <E2ETab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function E2ETab() {
  const [result, setResult] = useState(null);
  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke('runEndToEndSimulation', {}),
    onSuccess: (res) => { setResult(res.data); },
    onError: () => toast.error('E2E simuliacija nepavyko')
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {result && <>
            <Badge className="bg-green-100 text-green-800">{result.passed} praėjo</Badge>
            {result.failed > 0 && <Badge className="bg-red-100 text-red-800">{result.failed} nepraėjo</Badge>}
            <Badge variant={result.status === 'passed' ? 'default' : 'destructive'}>{result.status}</Badge>
          </>}
        </div>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${mutation.isPending ? 'animate-spin' : ''}`} />
          {mutation.isPending ? 'Simuliuojama...' : 'Vykdyti simuliaciją'}
        </Button>
      </div>

      {!result && !mutation.isPending && (
        <Card><CardContent className="pt-8 pb-8 text-center text-muted-foreground text-sm">
          Simuliuoja visą Inquiry → Deal → Commission → Payout grandinę (DRY RUN — nerašo realių duomenų)
        </CardContent></Card>
      )}

      {result && (
        <div className="space-y-2">
          {(result.steps || []).map((s, i) => {
            const passed = s.status === 'passed';
            return (
              <Card key={i} className={passed ? 'border-green-200' : 'border-red-200'}>
                <CardContent className="py-3 flex items-start gap-3">
                  {passed ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{s.step.replace(/_/g, ' ')}</p>
                      <span className="text-xs text-muted-foreground">{s.durationMs}ms</span>
                    </div>
                    {s.error && <p className="text-xs text-destructive mt-0.5">{s.error}</p>}
                    {s.data && !s.error && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.data.dryRun ? '(DRY RUN) ' : ''}{s.data.wouldCreate || JSON.stringify(s.data).slice(0, 80)}
                      </p>
                    )}
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