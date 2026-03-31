import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, MapPin, Wallet, Users } from 'lucide-react';

export default function SecondaryBuyerCard({ buyer }) {
  return (
    <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm">{buyer.clientName}</p>
          <Badge className="mt-1 bg-amber-100 text-amber-800 text-xs">Pirkėjas</Badge>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{buyer.city || '—'} {buyer.district && `(${buyer.district})`}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Home className="h-3.5 w-3.5" />
            <span>{buyer.propertyType || '—'} {buyer.rooms && `• ${buyer.rooms}k.`}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span>€{buyer.budgetMin?.toLocaleString('lt-LT') || '0'}-{buyer.budgetMax?.toLocaleString('lt-LT') || '0'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Badge variant="outline" className="text-xs">
            {buyer.status === 'active' ? 'Aktyvus' : 'Pauzė'}
          </Badge>
          {buyer.assignedAgentName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {buyer.assignedAgentName}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}