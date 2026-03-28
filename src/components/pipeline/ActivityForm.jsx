import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { ACTIVITY_TYPE_LABELS } from '@/lib/pipelineConstants';

export default function ActivityForm({ onSubmit, saving }) {
  const [form, setForm] = useState({
    type: 'call',
    scheduledAt: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  const [open, setOpen] = useState(false);

  const handleSubmit = () => {
    if (!form.type) return;
    onSubmit(form);
    setForm({ type: 'call', scheduledAt: new Date().toISOString().slice(0, 16), notes: '' });
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Pridėti veiklą
      </Button>
    );
  }

  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
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
        <Button size="sm" onClick={handleSubmit} disabled={saving} className="flex-1">
          Sukurti
        </Button>
      </div>
    </div>
  );
}