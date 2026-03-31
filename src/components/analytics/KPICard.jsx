import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function KPICard({ title, value, icon: IconComponent, trend, trendLabel, color = 'primary' }) {
  const Icon = IconComponent;
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-600',
    warning: 'bg-amber-500/10 text-amber-600',
    destructive: 'bg-red-500/10 text-red-600',
    secondary: 'bg-secondary text-secondary-foreground'
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                {trend > 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-600" />
                ) : trend < 0 ? (
                  <ArrowDown className="h-3 w-3 text-red-600" />
                ) : null}
                <span className={trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                  {trendLabel}
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}