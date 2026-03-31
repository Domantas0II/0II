import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function SecondaryKPICard({ title, value, icon: Icon, color = 'purple', trend }) {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-1 text-xs">
                {trend > 0 ? (
                  <ArrowUp className="h-3 w-3 text-green-600" />
                ) : trend < 0 ? (
                  <ArrowDown className="h-3 w-3 text-red-600" />
                ) : null}
                <span className={trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                  {Math.abs(trend)}%
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