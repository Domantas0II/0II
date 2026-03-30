import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone } from 'lucide-react';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@/lib/pipelineConstants';

/**
 * Post-call modal — shown AFTER the call is initiated.
 * callStartedAt is passed in from the parent (captured at tel: click time).
 */
export default function CallModal({ open, onClose, onSave, interest, saving, callStartedAt }) {
  const [comment, setComment] = useState('');
  const [newStage, setNewStage] = useState('');

  // Reset on open
  useEffect(() => {
    if (open) {
      setComment('');
      setNewStage('');
    }
  }, [open]);

  const handleSave = () => {
    onSave({
      comment: comment.trim(),
      newStage: newStage || null,
      callStartedAt,
    });
  };

  const handleClose = () => {
    setComment('');
    setNewStage('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent
        className="max-w-md w-[calc(100%-2rem)] sm:w-full rounded-xl"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={handleClose}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4 text-green-600" />
            Po skambučio — {interest?.fullName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Etapas — visada matomas, neprivalomas */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Etapas</label>
            <Select value={newStage} onValueChange={setNewStage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Palikti tą patį etapą..." />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map(s => (
                  <SelectItem key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Komentaras — neprivalomas */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Komentaras <span className="text-muted-foreground font-normal text-xs">(neprivalomas)</span>
            </label>
            <Textarea
              placeholder="Kas aptarta, kliento reakcija, kitas žingsnis..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="h-24 text-sm resize-none"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row justify-end">
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