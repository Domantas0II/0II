import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const STATUS_STYLES = { success: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800', pending: 'bg-yellow-100 text-yellow-800' };
const STATUS_LABELS = { success: 'Sėkminga', failed: 'Nepavyko', pending: 'Laukia' };

export default function WebhookLogs() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['webhook-deliveries'],
    queryFn: () => base44.entities.WebhookDelivery.list('-created_date', 200)
  });

  const { data: events = [] } = useQuery({
    queryKey: ['integration-events'],
    queryFn: () => base44.entities.IntegrationEvent.list('-created_date', 200)
  });

  const { data: endpoints = [] } = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: () => base44.entities.WebhookEndpoint.list('-created_date', 100)
  });
  const endpointsMap = Object.fromEntries((endpoints || []).map(e => [e.id, e]));

  const retryMutation = useMutation({
    mutationFn: async (delivery) => {
      const ep = endpointsMap[delivery.endpointId];
      if (!ep) throw new Error('Endpoint nerastas');
      const payload = delivery.payloadJson ? JSON.parse(delivery.payloadJson) : {};
      return base44.functions.invoke('dispatchEvent', {
        eventType: delivery.eventType,
        entityType: payload.entityType || 'unknown',
        entityId: payload.entityId || delivery.endpointId,
        payload
      });
    },
    onSuccess: () => { toast.success('Retry dispatched'); queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] }); },
    onError: (e) => toast.error(e?.message || 'Retry nepavyko')
  });

  const filtered = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (eventFilter !== 'all' && d.eventType !== eventFilter) return false;
    return true;
  });

  const eventTypes = [...new Set(deliveries.map(d => d.eventType).filter(Boolean))];
  const last24h = deliveries.filter(d => new Date(d.createdAt || d.created_date) > new Date(Date.now() - 86400000));
  const failedCount = deliveries.filter(d => d.status === 'failed').length;
  const successRate = deliveries.length ? Math.round((deliveries.filter(d => d.status === 'success').length / deliveries.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="h-6 w-6" />Webhook Delivery Logs</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Iš viso (24h)', val: last24h.length, icon: Activity },
          { label: 'Nepavyko', val: failedCount, icon: AlertTriangle, color: failedCount > 0 ? 'text-destructive' : '' },
          { label: 'Sėkmė %', val: `${successRate}%`, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Events (24h)', val: events.filter(e => new Date(e.createdAt || e.created_date) > new Date(Date.now() - 86400000)).length, icon: Clock },
        ].map(({ label, val, icon: Icon, color = '' }) => (
          <Card key={label}><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi statusai</SelectItem>
            <SelectItem value="success">Sėkminga</SelectItem>
            <SelectItem value="failed">Nepavyko</SelectItem>
            <SelectItem value="pending">Laukia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Visi event tipai" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi event tipai</SelectItem>
            {eventTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} įrašai</span>
      </div>

      {/* Deliveries */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">Delivery įrašų nėra</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const ep = endpointsMap[d.endpointId];
            return (
              <Card key={d.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Badge className={STATUS_STYLES[d.status]}>{STATUS_LABELS[d.status]}</Badge>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{d.eventType}</span>
                          {d.responseStatus && <Badge variant="outline" className="text-xs">{d.responseStatus}</Badge>}
                          <span className="text-xs text-muted-foreground">#{d.attemptCount || 0} bandymas</span>
                        </div>
                        {ep && <p className="text-xs text-muted-foreground truncate mt-0.5">{ep.url}</p>}
                        {d.responseBody && <p className="text-xs text-muted-foreground mt-1 truncate opacity-70">{d.responseBody}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.lastAttemptAt ? new Date(d.lastAttemptAt).toLocaleString('lt-LT') : ''}
                        </p>
                      </div>
                    </div>
                    {d.status === 'failed' && (
                      <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => retryMutation.mutate(d)} disabled={retryMutation.isPending}>
                        <RefreshCw className="h-3 w-3" />Retry
                      </Button>
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