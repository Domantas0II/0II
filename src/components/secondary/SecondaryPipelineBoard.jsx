import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import SecondaryCallModal from './SecondaryCallModal';
import { useState } from 'react';

const OBJECT_STAGES = [
  { id: 'new_object', label: 'Naujas', color: 'bg-slate-100' },
  { id: 'contacted', label: 'Kontaktas', color: 'bg-blue-100' },
  { id: 'documentation', label: 'Dokumentacija', color: 'bg-amber-100' },
  { id: 'active_listing', label: 'Aktyvi', color: 'bg-purple-100' },
  { id: 'showing', label: 'Peržiūros', color: 'bg-cyan-100' },
  { id: 'offer_received', label: 'Pasiūlymas', color: 'bg-lime-100' },
  { id: 'negotiating', label: 'Derybos', color: 'bg-orange-100' },
  { id: 'sold', label: 'Parduotas', color: 'bg-green-100' }
];

const BUYER_STAGES = [
  { id: 'new_buyer', label: 'Naujas', color: 'bg-slate-100' },
  { id: 'profiled', label: 'Profilis', color: 'bg-blue-100' },
  { id: 'searching', label: 'Paieška', color: 'bg-purple-100' },
  { id: 'viewing', label: 'Peržiūros', color: 'bg-cyan-100' },
  { id: 'shortlisted', label: 'Susitrumpinti', color: 'bg-amber-100' },
  { id: 'offer_made', label: 'Pasiūlymas', color: 'bg-orange-100' },
  { id: 'negotiating', label: 'Derybos', color: 'bg-lime-100' },
  { id: 'purchased', label: 'Nupirko', color: 'bg-green-100' }
];

export default function SecondaryPipelineBoard({ pipelineType, data = [], currentUser }) {
  const stages = pipelineType === 'objects' ? OBJECT_STAGES : BUYER_STAGES;
  const [selectedCard, setSelectedCard] = useState(null);

  const cardsByStage = {};
  stages.forEach(s => {
    cardsByStage[s.id] = data.filter(d => d.stage === s.id) || [];
  });

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <div key={stage.id} className={`rounded-lg p-3 min-w-[300px] ${stage.color}`}>
            <h3 className="font-semibold text-sm mb-3">
              {stage.label} <span className="text-xs text-muted-foreground">({cardsByStage[stage.id]?.length || 0})</span>
            </h3>
            <div className="space-y-2">
              {(cardsByStage[stage.id] || []).map(item => (
                <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">
                      {pipelineType === 'objects' ? item.title : item.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pipelineType === 'objects'
                        ? `${item.address} • €${item.price}`
                        : `€${item.budgetMin}-${item.budgetMax}`
                      }
                    </p>
                    {item.assignedAgentUserId === currentUser?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full mt-2 h-7 gap-1"
                        onClick={() => setSelectedCard(item)}
                      >
                        <Phone className="h-3 w-3" /> Skambinti
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedCard && (
        <SecondaryCallModal
          item={selectedCard}
          pipelineType={pipelineType}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </>
  );
}