import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Key, Plus, Copy, ToggleLeft, ToggleRight, ShieldAlert } from 'lucide-react';

const SCOPE_COLORS = { internal: 'bg-blue-100 text-blue-800', partner: 'bg-green-100 text-green-800', public: 'bg-gray-100 text-gray-700' };

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ label: '', scope: 'partner', expiresAt: '' });
  const [newKeyData, setNewKeyData] = useState(null);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => base44.entities.ApiKey.list('-created_date', 100),
    enabled: isAdmin
  });

  const generateMutation = useMutation({
    mutationFn: () => base44.functions.invoke('generateApiKey', { label: form.label, scope: form.scope, expiresAt: form.expiresAt || null }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowCreate(false);
      setNewKeyData(res.data);
      setForm({ label: '', scope: 'partner', expiresAt: '' });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida generuojant raktą')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.ApiKey.update(id, { isActive }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Statusas pakeistas'); }
  });

  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-center"><ShieldAlert className="h-12 w-12 mx-auto mb-3 text-destructive opacity-50" /><p className="text-muted-foreground">Tik administratoriai gali valdyti API raktus</p></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Key className="h-6 w-6" />API Raktai</h1>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Generuoti raktą</Button>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-xs">
          API raktai saugomi tik kaip SHA-256 hash. Plaintext raktas rodomas <strong>tik vieną kartą</strong> sukūrimo metu ir niekada nebegali būti atgautas.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : apiKeys.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">API raktų nėra</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {apiKeys.map(k => (
            <Card key={k.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge className={SCOPE_COLORS[k.scope]}>{k.scope}</Badge>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{k.label}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>Sukurta: {new Date(k.createdAt || k.created_date).toLocaleDateString('lt-LT')}</span>
                      {k.lastUsedAt && <span>Naudota: {new Date(k.lastUsedAt).toLocaleDateString('lt-LT')}</span>}
                      {k.expiresAt && <span className={new Date(k.expiresAt) < new Date() ? 'text-destructive' : ''}>Galioja iki: {new Date(k.expiresAt).toLocaleDateString('lt-LT')}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={k.isActive ? 'default' : 'secondary'}>{k.isActive ? 'Aktyvus' : 'Neaktyvus'}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: k.id, isActive: !k.isActive })}>
                    {k.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Generuoti API raktą</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs font-medium text-muted-foreground">Apibūdinimas</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Pvz. Zapier integracija" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Scope</label>
              <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select></div>
            <div><label className="text-xs font-medium text-muted-foreground">Galiojimo pabaiga (neprivaloma)</label>
              <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} /></div>
            <Button className="w-full" onClick={() => generateMutation.mutate()} disabled={!form.label || generateMutation.isPending}>
              Generuoti
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show new key ONCE */}
      <Dialog open={!!newKeyData} onOpenChange={() => setNewKeyData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-destructive flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Išsaugokite raktą DABAR</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Šis raktas bus parodytas tik vieną kartą. Jis niekada negalės būti atgautas.</p>
          <div className="bg-secondary rounded-lg p-3 font-mono text-sm break-all mt-2">{newKeyData?.rawKey}</div>
          <Button className="w-full gap-2" onClick={() => { navigator.clipboard.writeText(newKeyData?.rawKey || ''); toast.success('Raktas nukopijuotas'); }}>
            <Copy className="h-4 w-4" />Kopijuoti į clipboard
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setNewKeyData(null)}>Supratau, uždaryti</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}