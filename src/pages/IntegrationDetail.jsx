import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, ToggleLeft, ToggleRight } from 'lucide-react';

const TYPE_LABELS = { webhook: 'Webhook', api: 'API', partner: 'Partneris', internal: 'Vidinis' };

export default function IntegrationDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR';

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integration', id],
    queryFn: () => base44.entities.Integration.filter({ id }),
    onSuccess: (data) => { if (data[0] && !form) setForm(data[0]); }
  });
  const integration = integrations[0];

  const { data: events = [] } = useQuery({
    queryKey: ['integration-events', id],
    queryFn: () => base44.entities.IntegrationEvent.list('-created_date', 50)
  });

  const updateMutation = useMutation({
    mutationFn: () => base44.entities.Integration.update(id, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integration', id] }); setEditing(false); toast.success('Išsaugota'); }
  });

  const toggleMutation = useMutation({
    mutationFn: (status) => base44.entities.Integration.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integration', id] })
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Kraunama...</div>;
  if (!integration) return <div className="p-8 text-center text-muted-foreground">Integracija nerasta</div>;

  const displayForm = form || integration;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/integrations"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">{integration.name}</h1>
        <Badge>{TYPE_LABELS[integration.type]}</Badge>
        <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>{integration.status === 'active' ? 'Aktyvus' : 'Neaktyvus'}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Konfigūracija</CardTitle>
          {isAdmin && (
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="gap-1"><Save className="h-3 w-3" />Išsaugoti</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(integration); }}>Atšaukti</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setForm(integration); setEditing(true); }}>Redaguoti</Button>
                  <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate(integration.status === 'active' ? 'inactive' : 'active')}>
                    {integration.status === 'active' ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div><label className="text-xs font-medium text-muted-foreground">Pavadinimas</label>
                <Input value={displayForm.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Tipas</label>
                <Select value={displayForm.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><label className="text-xs font-medium text-muted-foreground">Base URL</label>
                <Input value={displayForm.baseUrl || ''} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} /></div>
              <div><label className="text-xs font-medium text-muted-foreground">Auth tipas</label>
                <Select value={displayForm.authType} onValueChange={v => setForm(f => ({ ...f, authType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nėra</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="bearer">Bearer</SelectItem>
                  </SelectContent>
                </Select></div>
              <div><label className="text-xs font-medium text-muted-foreground">Config JSON</label>
                <Textarea value={displayForm.configJson || '{}'} onChange={e => setForm(f => ({ ...f, configJson: e.target.value }))} className="font-mono text-xs h-24" /></div>
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Tipas</span><span>{TYPE_LABELS[integration.type]}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Base URL</span><span className="truncate ml-4">{integration.baseUrl || '—'}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-muted-foreground">Auth</span><span>{integration.authType}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Sukurta</span><span>{integration.createdAt ? new Date(integration.createdAt).toLocaleDateString('lt-LT') : '—'}</span></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent events */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Paskutiniai events</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Eventų nėra</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 20).map(e => (
                <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{e.eventType}</Badge>
                    <span className="text-muted-foreground text-xs">{e.entityType} #{e.entityId?.slice(-6)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.processed ? 'default' : 'secondary'} className="text-xs">{e.processed ? 'Processed' : 'Pending'}</Badge>
                    <span className="text-xs text-muted-foreground">{e.createdAt ? new Date(e.createdAt).toLocaleString('lt-LT') : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}