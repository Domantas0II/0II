import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Phone } from 'lucide-react';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/pipelineConstants';

export default function CallModal({ open, onClose, onSave, interest, saving }) {
  const [comment, setComment] = useState('');
  const [changeStage, setChangeStage] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!comment.trim()) {
      setError('Komentaras yra privalomas');
      return;
    }
    if (changeStage && !newStage) {
      setError('Pasirinkite naują etapą');
      return;
    }
    setError('');
    onSave({
      comment: comment.trim(),
      newStage: changeStage ? newStage : null,
    });
  };

  const handleClose = () => {
    setComment('');
    setChangeStage(false);
    setNewStage('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Skambutis — {interest?.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Comment — mandatory */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Komentaras <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Kas aptarta, kliento reakcija, kitas žingsnis..."
              value={comment}
              onChange={e => { setComment(e.target.value); setError(''); }}
              className={`h-24 text-sm ${error && !comment.trim() ? 'border-destructive' : ''}`}
              autoFocus
            />
          </div>

          {/* Stage change toggle */}
          <div className="flex items-center justify-between py-2 border rounded-lg px-3">
            <span className="text-sm font-medium">Keisti etapą po skambučio?</span>
            <Switch checked={changeStage} onCheckedChange={setChangeStage} />
          </div>

          {changeStage && (
            <Select value={newStage} onValueChange={v => { setNewStage(v); setError(''); }}>
              <SelectTrigger className={error && changeStage && !newStage ? 'border-destructive' : ''}>
                <SelectValue placeholder="Pasirinkite naują etapą..." />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map(s => (
                  <SelectItem key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>Atšaukti</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Phone className="h-4 w-4" />
            {saving ? 'Saugoma...' : 'Išsaugoti'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}