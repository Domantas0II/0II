import React, { useState } from 'react';
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ShieldAlert, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const STATUS_CFG = {
  ok:       { icon: CheckCircle2, color: 'text-green-600', bg: 'border-green-200 bg-green-50', badge: 'bg-green-100 text-green-800' },
  warning:  { icon: AlertTriangle, color: 'text-yellow-600', bg: 'border-yellow-200 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800' },
  critical: { icon: XCircle, color: 'text-destructive', bg: 'border-red-200 bg-red-50', badge: 'bg-red-100 text-red-800' },
};

const CHECK_LABELS = {
  expired_api_keys: 'Pasibaigę API raktai',
  expired_external_tokens: 'Pasibaigę external tokenai',
  webhook_endpoints_security: 'Webhook HMAC signing',
  file_visibility: 'Failų matomumas',
  revoked_grants: 'Atšaukti prieigos leidimai',
  integration_auth_config: 'Integracijų autentifikacija',
};

export default function SecurityAuditPage() {
  const [result, setResult] = useState(null);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const runMutation = useMutation({
    mutationFn: () => base44.functions.invoke('runSecurityAudit', {}),
    onSuccess: (res) => {
      setResult(res.data);
      const c = res.data.criticalCount;
      if (c > 0) toast.error(`${c} kritinė saugumo problema`);
      else toast.success('Saugumo auditas baigtas');
    },
    onError: () => toast.error('Auditas nepavyko')
  });

  const checks = result?.checks || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6" />Saugumo auditas</h1>
          <p className="text-muted-foreground text-sm">API raktai, tokenai, webhook signing, failų prieiga</p>
        </div>
        {isAdmin && (
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
            Vykdyti auditą
          </Button>
        )}
      </div>

      {result && (
        <div className="flex gap-2">
          <Badge className="bg-green-100 text-green-800">{checks.filter(c => c.status === 'ok').length} OK</Badge>
          {result.warningCount > 0 && <Badge className="bg-yellow-100 text-yellow-800">{result.warningCount} perspėjimų</Badge>}
          {result.criticalCount > 0 && <Badge className="bg-red-100 text-red-800">{result.criticalCount} kritinių</Badge>}
        </div>
      )}

      {!result && !runMutation.isPending && (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p>Spauskite "Vykdyti auditą"</p>
        </CardContent></Card>
      )}

      {runMutation.isPending && (
        <Card><CardContent className="pt-12 pb-12 text-center">
          <RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
          <p className="text-sm text-muted-foreground">Tikrinamas saugumas...</p>
        </CardContent></Card>
      )}

      {checks.map(check => {
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
              {(check.items || []).length > 0 && (
                <div className="mt-3 space-y-1">
                  {check.items.map((item, i) => (
                    <div key={i} className="text-xs text-muted-foreground bg-background rounded px-2 py-1 border">
                      {item.label || item.key || item.id || item.issue || JSON.stringify(item)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}