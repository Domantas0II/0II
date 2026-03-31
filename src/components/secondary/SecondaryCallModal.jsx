import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Phone, Clock } from 'lucide-react';

const NEXT_STAGES = {
  objects: {
    new_object: 'contacted',
    contacted: 'documentation',
    documentation: 'active_listing',
    active_listing: 'showing',
    showing: 'offer_received',
    offer_received: 'negotiating',
    negotiating: 'sold'
  },
  buyers: {
    new_buyer: 'profiled',
    profiled: 'searching',
    searching: 'viewing',
    viewing: 'shortlisted',
    shortlisted: 'offer_made',
    offer_made: 'negotiating',
    negotiating: 'purchased'
  }
};

export default function SecondaryCallModal({ item, pipelineType, onClose }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [nextStage, setNextStage] = useState('');
  const [callTime, setCallTime] = useState(new Date().toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' }));

  const saveCallMutation = useMutation({
    mutationFn: () => base44.functions.invoke('logSecondaryCall', {
      itemId: item.id,
      pipelineType,
      callTime,
      comment,
      nextStage
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`secondary-pipeline-${pipelineType}`] });
      toast.success('Skambutis užregistruotas');
      onClose();
    }
  });

  const handleSkambinti = () => {
    window.location.href = `tel:${item.phone || item.agentPhone}`;
  };

  const showStageSelect = ['offer_received', 'negotiating'].includes(item.stage);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Skambutis – {pipelineType === 'objects' ? item.title : item.clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{callTime}</span>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Skambinti</label>
            <Button onClick={handleSkambinti} className="w-full gap-2">
              <Phone className="h-4 w-4" /> {item.phone || item.agentPhone}
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Pastaba</label>
            <Textarea
              placeholder="Pokalbio pastabos..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-20"
            />
          </div>

          {showStageSelect && (
            <div>
              <label className="text-sm font-medium mb-1 block">Keisti į etapą</label>
              <Select value={nextStage} onValueChange={setNextStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Pasirinkti..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEXT_STAGES[pipelineType][item.stage]}>
                    {NEXT_STAGES[pipelineType][item.stage]}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Atšaukti</Button>
          <Button
            onClick={() => saveCallMutation.mutate()}
            disabled={saveCallMutation.isPending}
          >
            Išsaugoti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}