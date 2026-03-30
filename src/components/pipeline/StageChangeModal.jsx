import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/pipelineConstants';

export default function StageChangeModal({ open, onClose, onSave, interest, saving }) {
  const [comment, setComment] = useState('');
  const [newStage, setNewStage] = useState('');
  const [errors, setErrors] = useState({});

  const handleSave = () => {
    const e = {};
    if (!newStage) e.stage = 'Pasirinkite naują etapą';
    if (!comment.trim()) e.comment = 'Komentaras yra privalomas';
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    onSave({ newStage, comment: comment.trim() });
  };

  const handleClose = () => {
    setComment('');
    setNewStage('');
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            Keisti etapą — {interest?.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Dabartinis etapas: <strong>{PIPELINE_STAGE_LABELS[interest?.pipelineStage] || interest?.pipelineStage}</strong>
            </p>
            <Select value={newStage} onValueChange={v => { setNewStage(v); setErrors(prev => ({...prev, stage: ''})); }}>
              <SelectTrigger className={errors.stage ? 'border-destructive' : ''}>
                <SelectValue placeholder="Naujas etapas..." />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.filter(s => s !== interest?.pipelineStage).map(s => (
                  <SelectItem key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.stage && <p className="text-xs text-destructive mt-1">{errors.stage}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Komentaras <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Priežastis arba pastaba..."
              value={comment}
              onChange={e => { setComment(e.target.value); setErrors(prev => ({...prev, comment: ''})); }}
              className={`h-20 text-sm ${errors.comment ? 'border-destructive' : ''}`}
            />
            {errors.comment && <p className="text-xs text-destructive mt-1">{errors.comment}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>Atšaukti</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Keičiama...' : 'Keisti etapą'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}