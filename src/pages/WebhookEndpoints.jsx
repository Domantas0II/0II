import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Webhook, Trash2, ToggleLeft, ToggleRight, Zap } from 'lucide-react';

const ALL_EVENT_TYPES = ['DEAL_CREATED', 'RESERVATION_CREATED', 'PARTNER_LEAD_CREATED', 'COMMISSION_RECEIVED', '*'];

const EMPTY_FORM = { url: '', secret: '', eventTypes: [], retryPolicyJson: '{"maxAttempts":5}' };

export default function WebhookEndpoints() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testingId, setTestingId] = useState(null);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const { data: endpoints = [], isLoading } = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: () => base44.entities.WebhookEndpoint.list('-created_date', 100)
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['webhook-deliveries-summary'],
    queryFn: () => base44.entities.WebhookDelivery.list('-created_date', 500)
  });

  const getEndpointStats = (epId) => ({
    total: deliveries.filter(d => d.endpointId === epId).length,
    success: deliveries.filter(d => d.endpointId === epId && d.status === 'success').length,
    failed: deliveries.filter(d => d.endpointId === epId && d.status === 'failed').length,
  });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.WebhookEndpoint.create({ ...form, createdAt: new Date().toISOString(), createdByUserId: currentUser?.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] }); setShowCreate(false); setForm(EMPTY_FORM); toast.success('Endpoint sukurtas'); },
    onError: () => toast.error('Klaida')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.WebhookEndpoint.update(id, { isActive }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] }); toast.success('Statusas pakeistas'); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WebhookEndpoint.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] }); toast.success('Endpoint ištrintas'); }
  });

  const testMutation = useMutation({
    mutationFn: async (ep) => {
      setTestingId(ep.id);
      const res = await base44.functions.invoke('dispatchEvent', {
        eventType: 'TEST_EVENT',
        entityType: 'Test',
        entityId: ep.id,
        payload: { message: 'Test delivery from CRM', endpointId: ep.id, timestamp: new Date().toISOString() }
      });
      return res.data;
    },
    onSuccess: () => { toast.success('Test event dispatched'); setTestingId(null); queryClient.invalidateQueries({ queryKey: ['webhook-deliveries-summary'] }); },
    onError: () => { toast.error('Test nepavyko'); setTestingId(null); }
  });

  const toggleEventType = (type) => {
    setForm(f => ({
      ...f,
      eventTypes: f.eventTypes.includes(type) ? f.eventTypes.filter(t => t !== type) : [...f.eventTypes, type]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Webhook className="h-6 w-6" />Webhook Endpoints</h1>
        {isAdmin && <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Naujas endpoint</Button>}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : endpoints.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">Webhook endpointų nėra</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {endpoints.map(ep => {
            const stats = getEndpointStats(ep.id);
            return (
              <Card key={ep.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={ep.isActive ? 'default' : 'secondary'}>{ep.isActive ? 'Aktyvus' : 'Neaktyvus'}</Badge>
                        <span className="text-sm font-mono truncate text-muted-foreground">{ep.url}</span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(ep.eventTypes || []).map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Deliveries: {stats.total}</span>
                        <span className="text-green-600">✓ {stats.success}</span>
                        {stats.failed > 0 && <span className="text-destructive">✗ {stats.failed}</span>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => testMutation.mutate(ep)} disabled={testingId === ep.id}>
                          <Zap className="h-4 w-4 text-yellow-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: ep.id, isActive: !ep.isActive })}>
                          {ep.isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(ep.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Naujas Webhook Endpoint</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs font-medium text-muted-foreground">Destination URL</label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Secret (HMAC signing, neprivaloma)</label>
              <Input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="whsec_..." type="password" /></div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Event tipai</label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENT_TYPES.map(t => (
                  <button key={t} onClick={() => toggleEventType(t)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${form.eventTypes.includes(t) ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-secondary'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="text-xs font-medium text-muted-foreground">Max retry bandymų</label>
              <Input type="number" min={1} max={5} value={JSON.parse(form.retryPolicyJson).maxAttempts || 5}
                onChange={e => setForm(f => ({ ...f, retryPolicyJson: JSON.stringify({ maxAttempts: parseInt(e.target.value) }) }))} /></div>
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.url || !form.eventTypes.length || createMutation.isPending}>
              Sukurti
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}