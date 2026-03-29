import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { normalizeRole } from '@/lib/constants';
import { AlertCircle, Phone, CheckCircle2, Clock, Calendar, Home } from 'lucide-react';

const BAND_COLORS = {
  critical: 'bg-red-100 border-red-500 text-red-900',
  high: 'bg-orange-100 border-orange-500 text-orange-900',
  medium: 'bg-blue-100 border-blue-500 text-blue-900',
  low: 'bg-gray-100 border-gray-500 text-gray-900'
};

const ACTION_ICONS = {
  call_now: <Phone className="h-4 w-4" />,
  send_followup: <Clock className="h-4 w-4" />,
  schedule_visit: <Calendar className="h-4 w-4" />,
  propose_units: <Home className="h-4 w-4" />,
  escalate_to_manager: <AlertCircle className="h-4 w-4" />,
  wait: <Clock className="h-4 w-4" />,
  close_out: <CheckCircle2 className="h-4 w-4" />
};

export default function PriorityQueue() {
  const { user } = useOutletContext();
  const role = normalizeRole(user?.role);

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['priorityQueue', user?.id],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPriorityQueue', {
        projectIds: [],
        assignedUserId: role === 'SALES_AGENT' ? user.id : undefined
      });
      return response.data?.queue || [];
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return <div className="text-center py-10">Kraunasi...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Prioriteto Eilė</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {role === 'SALES_AGENT' ? 'Tavo prioritetinės užduotys' : 'Komandos prioritetai'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-2xl font-bold text-red-600">{queue.filter(i => i.band === 'critical').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">High</p>
            <p className="text-2xl font-bold text-orange-600">{queue.filter(i => i.band === 'high').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Medium</p>
            <p className="text-2xl font-bold text-blue-600">{queue.filter(i => i.band === 'medium').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Iš viso</p>
            <p className="text-2xl font-bold text-primary">{queue.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {queue.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nėra prioritetinių elementų
            </CardContent>
          </Card>
        ) : (
          queue.map((item, idx) => {
            const reasons = JSON.parse(item.reasonsJson || '[]');
            const topReason = reasons[0];

            return (
              <Card key={idx} className={`border-2 ${BAND_COLORS[item.band]}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-primary text-white">{item.scoreValue}</Badge>
                        <Badge variant="outline">{item.band}</Badge>
                      </div>

                      <h3 className="font-medium text-sm mb-1">{item.title || `${item.type} - ${item.entityId}`}</h3>

                      {topReason && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <strong>{topReason.factor}:</strong> {topReason.explanation}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground italic">
                        {item.recommendationText}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      className="gap-1 whitespace-nowrap"
                      variant={item.band === 'critical' ? 'destructive' : 'outline'}
                    >
                      {ACTION_ICONS[item.recommendedAction] || null}
                      {item.recommendedAction === 'call_now' ? 'Skambinti' : item.recommendedAction === 'send_followup' ? 'Follow-up' : 'Veiksmas'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}