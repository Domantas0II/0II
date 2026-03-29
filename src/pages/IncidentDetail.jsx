import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Eye, Bug } from 'lucide-react';

const SEV_COLORS = { critical: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-gray-100 text-gray-700' };
const STATUS_COLORS = { open: 'bg-red-100 text-red-800', investigating: 'bg-blue-100 text-blue-800', resolved: 'bg-green-100 text-green-800' };
const STATUS_LABELS = { open: 'Atidarytas', investigating: 'Tiriamas', resolved: 'Išspręstas' };

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-64">{value || '—'}</span>
    </div>
  );
}

export default function IncidentDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const canAct = currentUser?.role === 'admin' || currentUser?.role === 'ADMINISTRATOR' || currentUser?.role === 'SALES_MANAGER';

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => base44.entities.SystemIncident.filter({ id })
  });
  const incident = incidents[0];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['incident', id] });

  const acknowledgeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('acknowledgeIncident', { incidentId: id, comment }),
    onSuccess: () => { invalidate(); toast.success('Incidentas paimtas tirti'); setComment(''); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const resolveMutation = useMutation({
    mutationFn: () => base44.functions.invoke('resolveIncident', { incidentId: id, comment }),
    onSuccess: () => { invalidate(); toast.success('Incidentas išspręstas'); setComment(''); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Kraunama...</div>;
  if (!incident) return <div className="p-8 text-center text-muted-foreground">Incidentas nerastas</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/incidents"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <Bug className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold">{incident.incidentType.replace(/_/g, ' ')}</h1>
        <Badge className={SEV_COLORS[incident.severity]}>{incident.severity}</Badge>
        <Badge className={STATUS_COLORS[incident.status]}>{STATUS_LABELS[incident.status]}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Detalės</CardTitle></CardHeader>
        <CardContent>
          <InfoRow label="Tipas" value={incident.incidentType} />
          <InfoRow label="Aprašas" value={incident.description} />
          <InfoRow label="Susiję entity" value={incident.relatedEntityType ? `${incident.relatedEntityType} #${incident.relatedEntityId?.slice(-6)}` : null} />
          <InfoRow label="Sukurtas" value={new Date(incident.createdAt).toLocaleString('lt-LT')} />
          {incident.acknowledgedAt && <InfoRow label="Paimtas tirti" value={new Date(incident.acknowledgedAt).toLocaleString('lt-LT')} />}
          {incident.resolvedAt && <InfoRow label="Išspręstas" value={new Date(incident.resolvedAt).toLocaleString('lt-LT')} />}
          {incident.comment && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-1">Komentaras</p>
              <p className="text-sm">{incident.comment}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canAct && incident.status !== 'resolved' && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Veiksmai</p>
            <Textarea
              placeholder="Komentaras (neprivaloma)..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="h-20"
            />
            <div className="flex gap-2">
              {incident.status === 'open' && (
                <Button variant="outline" onClick={() => acknowledgeMutation.mutate()} disabled={acknowledgeMutation.isPending} className="gap-2">
                  <Eye className="h-4 w-4" />Imtis tirti
                </Button>
              )}
              <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending} className="gap-2">
                <CheckCircle className="h-4 w-4" />Žymėti išspręstu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}