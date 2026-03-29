import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Plug, ChevronRight, ToggleLeft, ToggleRight, Webhook, Key, Activity } from 'lucide-react';

const TYPE_LABELS = { webhook: 'Webhook', api: 'API', partner: 'Partneris', internal: 'Vidinis' };
const TYPE_COLORS = { webhook: 'bg-purple-100 text-purple-800', api: 'bg-blue-100 text-blue-800', partner: 'bg-green-100 text-green-800', internal: 'bg-gray-100 text-gray-700' };

const EMPTY_FORM = { name: '', type: 'webhook', baseUrl: '', authType: 'none', configJson: '{}' };

export default function IntegrationsList() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => base44.entities.Integration.list('-created_date', 100)
  });

  const { data: events = [] } = useQuery({
    queryKey: ['integration-events-count'],
    queryFn: () => base44.entities.IntegrationEvent.list('-created_date', 200)
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['webhook-deliveries-summary'],
    queryFn: () => base44.entities.WebhookDelivery.list('-created_date', 200)
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Integration.create({ ...form, createdAt: new Date().toISOString(), createdByUserId: currentUser?.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrations'] }); setShowCreate(false); setForm(EMPTY_FORM); toast.success('Integracija sukurta'); },
    onError: () => toast.error('Klaida kuriant integraciją')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Integration.update(id, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrations'] }); toast.success('Statusas pakeistas'); }
  });

  const last24h = events.filter(e => new Date(e.createdAt) > new Date(Date.now() - 86400000));
  const failedDeliveries = deliveries.filter(d => d.status === 'failed');
  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Plug className="h-7 w-7" />Integrations Hub</h1>
          <p className="text-muted-foreground text-sm mt-1">Išorinės integracijos, webhooks, API raktai</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Nauja integracija</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Integracijos', val: integrations.length, color: 'text-primary' },
          { label: 'Eventai (24h)', val: last24h.length, color: 'text-blue-600' },
          { label: 'Nepavykę deliveries', val: failedDeliveries.length, color: 'text-destructive' },
          { label: 'Laukia siuntimo', val: pendingDeliveries.length, color: 'text-yellow-600' },
        ].map(({ label, val, color }) => (
          <Card key={label}><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Quick nav */}
      <div className="flex gap-2 flex-wrap">
        <Link to="/webhook-endpoints"><Button variant="outline" size="sm" className="gap-2"><Webhook className="h-4 w-4" />Webhook Endpoints</Button></Link>
        <Link to="/api-keys"><Button variant="outline" size="sm" className="gap-2"><Key className="h-4 w-4" />API Raktai</Button></Link>
        <Link to="/webhook-logs"><Button variant="outline" size="sm" className="gap-2"><Activity className="h-4 w-4" />Delivery Logs</Button></Link>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : integrations.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">Integracijos nesukurtos</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {integrations.map(integration => (
            <Card key={integration.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge className={TYPE_COLORS[integration.type]}>{TYPE_LABELS[integration.type]}</Badge>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{integration.name}</p>
                    {integration.baseUrl && <p className="text-xs text-muted-foreground truncate">{integration.baseUrl}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                    {integration.status === 'active' ? 'Aktyvus' : 'Neaktyvus'}
                  </Badge>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: integration.id, status: integration.status === 'active' ? 'inactive' : 'active' })}>
                      {integration.status === 'active' ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  )}
                  <Link to={`/integrations/${integration.id}`}><Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button></Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nauja integracija</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs font-medium text-muted-foreground">Pavadinimas</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Pvz. Zapier webhook" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Tipas</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div><label className="text-xs font-medium text-muted-foreground">Base URL (neprivaloma)</label>
              <Input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://..." /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Auth tipas</label>
              <Select value={form.authType} onValueChange={v => setForm(f => ({ ...f, authType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nėra</SelectItem>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                </SelectContent>
              </Select></div>
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
              Sukurti
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}