import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ACTIVITY_TYPE_LABELS } from '@/lib/pipelineConstants';

export default function ActivityForm({ projectInterests, projects = [], onSubmit, saving }) {
  const [form, setForm] = useState({
    projectId: '',
    type: 'call',
    scheduledAt: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  const [open, setOpen] = useState(false);

  // Auto-select project if only one interest
  useEffect(() => {
    if (projectInterests?.length === 1 && !form.projectId) {
      setForm(prev => ({ ...prev, projectId: projectInterests[0].projectId }));
    }
  }, [projectInterests, form.projectId]);

  const handleSubmit = () => {
    if (!form.projectId || !form.type) return;
    onSubmit(form);
    setForm({ projectId: form.projectId, type: 'call', scheduledAt: new Date().toISOString().slice(0, 16), notes: '' });
    setOpen(false);
  };

  const isValid = form.projectId && form.type;

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Pridėti veiklą
      </Button>
    );
  }

  // Get available projects from interests
  const availableProjects = projectInterests ? projects.filter(p => projectInterests.some(i => i.projectId === p.id)) : [];
  const selectedProject = availableProjects.find(p => p.id === form.projectId);

  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
      {!projectInterests || projectInterests.length === 0 ? (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-700 text-sm">
            Nėra projektų. Pirmiausia pridėkite projektą kliento susidomėjimams.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {availableProjects.length > 1 ? (
            <Select value={form.projectId} onValueChange={v => setForm({ ...form, projectId: v })}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Pasirinkite projektą..." />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : form.projectId && selectedProject ? (
            <div className="p-2 rounded bg-card border text-sm">
              <p className="text-muted-foreground text-xs mb-1">Projektas</p>
              <p className="font-medium">{selectedProject.projectName}</p>
            </div>
          ) : null}

          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
            className="text-sm"
          />

          <Textarea
            placeholder="Pastabos..."
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            className="text-sm h-16"
          />

          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Atšaukti
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!isValid || saving} className="flex-1">
              Sukurti
            </Button>
          </div>
        </>
      )}
    </div>
  );
}