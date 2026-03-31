import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';

export default function ControlRecentDeals({ deals, clients, units, projects, users }) {
  const clientMap = Object.fromEntries((clients || []).map(c => [c.id, c]));
  const unitMap = Object.fromEntries((units || []).map(u => [u.id, u]));
  const projectMap = Object.fromEntries((projects || []).map(p => [p.id, p]));
  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

  const recent = (deals || [])
    .slice()
    .sort((a, b) => new Date(b.soldAt || b.created_date).getTime() - new Date(a.soldAt || a.created_date).getTime())
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Naujausi pardavimai
          </CardTitle>
          <Link to="/deals" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Visi →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nėra pardavimų</p>
        ) : (
          <div className="space-y-2">
            {recent.map(deal => {
              const client = clientMap[deal.clientId];
              const unit = unitMap[deal.unitId];
              const project = projectMap[deal.projectId];
              const soldBy = userMap[deal.soldByUserId];
              const date = deal.soldAt || deal.created_date;

              return (
                <Link
                  key={deal.id}
                  to={`/deals`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {client?.fullName || '—'}
                      </span>
                      {unit && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {unit.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      <span className="truncate">{project?.projectName || '—'}</span>
                      {soldBy && (
                        <>
                          <span>·</span>
                          <span className="truncate">{soldBy.full_name}</span>
                        </>
                      )}
                      {date && (
                        <>
                          <span>·</span>
                          <span>{format(new Date(date), 'yyyy-MM-dd')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-green-700 whitespace-nowrap">
                    €{(deal.totalAmount || 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}