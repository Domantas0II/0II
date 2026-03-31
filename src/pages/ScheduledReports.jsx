import React, { useState } from 'react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Calendar, Play, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const FREQ_LABELS = { daily: 'Kasdien', weekly: 'Kas savaitę', monthly: 'Kas mėnesį' };
const FREQ_COLORS = { daily: 'bg-blue-100 text-blue-800', weekly: 'bg-purple-100 text-purple-800', monthly: 'bg-green-100 text-green-800' };

export default function ScheduledReports() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    reportDefinitionId: '',
    scheduleType: 'weekly',
    recipientEmails: '',
    isActive: true
  });

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const role = normalizeRole(currentUser?.role);
  const canManage = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: () => base44.entities.ScheduledReport.list('-created_date', 100)
  });

  const { data: reportDefs = [] } = useQuery({
    queryKey: ['reportDefinitions'],
    queryFn: () => base44.entities.ReportDefinition.list('-created_date', 100)
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const emails = form.recipientEmails.split(',').map(e => e.trim()).filter(Boolean);
      const recipientsJson = JSON.stringify(emails.map(e => ({ type: 'email', value: e })));
      return base44.entities.ScheduledReport.create({
        name: form.name,
        reportDefinitionId: form.reportDefinitionId,
        scheduleType: form.scheduleType,
        scheduleConfigJson: JSON.stringify({}),
        recipientsJson,
        isActive: form.isActive,
        createdByUserId: currentUser?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      toast.success('Suplanuota ataskaita sukurta');
      setShowCreate(false);
      setForm({ name: '', reportDefinitionId: '', scheduleType: 'weekly', recipientEmails: '', isActive: true });
    },
    onError: (e) => toast.error(e?.message || 'Klaida')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => base44.entities.ScheduledReport.update(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledReports'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReport.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scheduledReports'] }); toast.success('Pašalinta'); }
  });

  const runNowMutation = useMutation({
    mutationFn: (scheduledReportId) => base44.functions.invoke('runScheduledReport', { scheduledReportId }),
    onSuccess: (res) => {
      if (res.data?.success) toast.success(`Paleista. Eilutės: ${res.data.rowCount || 0}`);
      else toast.error(res.data?.error || 'Klaida');
    },
    onError: (e) => toast.error(e?.message || 'Klaida')
  });

  const defMap = Object.fromEntries((reportDefs || []).map(d => [d.id, d]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Suplanuotos ataskaitos</h1>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />Nauja
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Nėra suplanuotų ataskaitų</p>
            {canManage && <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Kurti</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => {
            const def = defMap[s.reportDefinitionId];
            const recipients = s.recipientsJson ? JSON.parse(s.recipientsJson) : [];
            return (
              <Card key={s.id} className={s.isActive ? '' : 'opacity-60'}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge className={FREQ_COLORS[s.scheduleType]}>{FREQ_LABELS[s.scheduleType]}</Badge>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {def ? def.name : 'Ataskaita nerasta'} · {recipients.length} gavėjai
                        {s.lastRunAt && ` · Paskutinis: ${new Date(s.lastRunAt).toLocaleDateString('lt-LT')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && (
                      <>
                        <Switch
                          checked={s.isActive}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: s.id, isActive: v })}
                        />
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => runNowMutation.mutate(s.id)} disabled={runNowMutation.isPending}>
                          <Play className="h-3 w-3" />Dabar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nauja suplanuota ataskaita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Pavadinimas</label>
              <Input placeholder="pvz. Savaitinė finansų ataskaita" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ataskaita</label>
              <Select value={form.reportDefinitionId} onValueChange={v => setForm(p => ({ ...p, reportDefinitionId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pasirinkite..." /></SelectTrigger>
                <SelectContent>
                  {reportDefs.filter(d => d.isActive !== false).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Dažnumas</label>
              <Select value={form.scheduleType} onValueChange={v => setForm(p => ({ ...p, scheduleType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Kasdien</SelectItem>
                  <SelectItem value="weekly">Kas savaitę</SelectItem>
                  <SelectItem value="monthly">Kas mėnesį</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Gavėjų el. paštas</label>
              <Input placeholder="email1@co.lt, email2@co.lt" value={form.recipientEmails} onChange={e => setForm(p => ({ ...p, recipientEmails: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Atskirkite kableliu</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Atšaukti</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.reportDefinitionId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Saugoma...' : 'Sukurti'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}