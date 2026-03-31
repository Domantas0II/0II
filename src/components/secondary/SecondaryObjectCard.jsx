import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users } from 'lucide-react';

export default function SecondaryObjectCard({ object }) {
  const imageUrl = object.publicImages?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop';

  return (
    <Link to={`/secondary-pipeline`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow border-l-4 border-l-purple-500 cursor-pointer">
        <div className="relative">
          <img src={imageUrl} alt={object.title} className="w-full h-40 object-cover" />
          <Badge className="absolute top-2 right-2 bg-purple-600">ANTRINĖ</Badge>
          <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-bold">
            €{object.price?.toLocaleString('lt-LT') || '—'}
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div>
            <p className="font-semibold text-sm line-clamp-1">{object.title}</p>
            <div className="flex items-start gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground line-clamp-1">{object.address}</p>
            </div>
          </div>

          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-secondary rounded text-muted-foreground">{object.area}m²</span>
            {object.rooms && <span className="px-2 py-1 bg-secondary rounded text-muted-foreground">{object.rooms} k.</span>}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <Badge variant={
              object.status === 'available' ? 'outline' :
              object.status === 'reserved' ? 'default' :
              'secondary'
            } className="text-xs">
              {object.status === 'available' ? 'Laisva' : object.status === 'reserved' ? 'Rezervuota' : 'Parduota'}
            </Badge>
            {object.assignedAgentName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {object.assignedAgentName}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}