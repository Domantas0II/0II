import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

export default function UnitRecommendationsBlock({ clientId, projectId, interestId }) {
  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ['unitRecommendations', clientId, projectId],
    queryFn: async () => {
      const response = await base44.functions.invoke('generateUnitRecommendations', {
        clientId,
        projectId,
        interestId: interestId || undefined
      });
      return response.data?.recommendations || [];
    },
    enabled: !!clientId && !!projectId
  });

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Skaičiuojami variantai...</div>;
  }

  if (recommendations.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Nėra rekomendacijų
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map(rec => {
        const reasons = JSON.parse(rec.matchReasonsJson || '[]');
        const topReason = reasons[0];

        return (
          <Card key={rec.id} className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="h-3 w-3 text-blue-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-muted-foreground">Rekomenduojamas unit</p>
                  </div>
                  <Badge className="bg-blue-600 text-white text-xs">Score: {rec.matchScore}</Badge>
                  {topReason && (
                    <p className="text-xs text-muted-foreground mt-1">{topReason.explanation}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="text-xs">
                  Peržiūrėti
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}