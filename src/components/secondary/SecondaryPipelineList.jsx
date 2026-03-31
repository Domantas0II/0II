import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';

export default function SecondaryPipelineList({ pipelineType, data = [] }) {
  return (
    <div className="space-y-2">
      {data.map(item => (
        <Card key={item.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {pipelineType === 'objects' ? item.title : item.clientName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pipelineType === 'objects'
                    ? `${item.address} • €${item.price}`
                    : `€${item.budgetMin}-${item.budgetMax}`
                  }
                </p>
                <Badge className="mt-2 text-xs">{item.stage}</Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => window.location.href = `tel:${item.phone}`}
              >
                <Phone className="h-3.5 w-3.5" /> Skambinti
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}