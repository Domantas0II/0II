import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function FunnelChart({ data, title }) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Nėra duomenų
        </CardContent>
      </Card>
    );
  }

  const entries = Object.entries(data).filter(([_, value]) => value > 0);
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Nėra duomenų
        </CardContent>
      </Card>
    );
  }

  const max = Math.max(...entries.map(([_, v]) => v));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([stage, count]) => (
          <div key={stage}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium capitalize">{stage}</span>
              <Badge variant="outline">{count}</Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}