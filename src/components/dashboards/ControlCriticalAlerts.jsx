import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, UserX, CalendarX, TrendingDown, CheckCircle2 } from 'lucide-react';
import { STAGE_OVERDUE_THRESHOLD_DAYS } from '@/lib/pipelineConstants';

function AlertItem({ icon: IconComp, label, count, color, to }) {
  const Icon = IconComp;
  const colors = {
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const cls = colors[color] || colors.amber;

  return (
    <Link to={to} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${cls} hover:opacity-80 transition-opacity cursor-pointer`}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{label}</span>
      <span className="text-lg font-bold">{count}</span>
    </Link>
  );
}

export default function ControlCriticalAlerts({ alerts, interests }) {
  if (!alerts) return null;

  const now = new Date();
  const overdueReservations = alerts.overdueReservations?.length || 0;
  const overdueFollowUps = alerts.overdueFollowUps?.length || 0;

  // Leads without any nextFollowUpAt
  const noNextAction = (interests || []).filter(i =>
    !i.nextFollowUpAt &&
    !['not_relevant', 'reservation'].includes(i.pipelineStage)
  ).length;

  // No contact > 24h (new_contact stage)
  const noContact24h = (interests || []).filter(i =>
    i.pipelineStage === 'new_contact' &&
    i.created_date &&
    now.getTime() - new Date(i.created_date).getTime() > 24 * 60 * 60 * 1000
  ).length;

  // Stuck > threshold (uses canonical constants from pipelineConstants.js)
  const stuckLeads = (interests || []).filter(i => {
    const threshold = STAGE_OVERDUE_THRESHOLD_DAYS[i.pipelineStage] || 7;
    const from = i.stageUpdatedAt || i.created_date;
    if (!from) return false;
    return now.getTime() - new Date(from).getTime() > threshold * 24 * 60 * 60 * 1000;
  }).length;

  const totalAlerts = overdueReservations + overdueFollowUps + noNextAction + noContact24h;

  if (totalAlerts === 0 && stuckLeads === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-200 bg-green-50 text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-sm font-medium">Šiuo metu kritinių signalų nėra</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kritiniai signalai</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {overdueReservations > 0 && (
          <AlertItem icon={CalendarX} label="Pasibaigusios rezervacijos" count={overdueReservations} color="red" to="/reservations" />
        )}
        {overdueFollowUps > 0 && (
          <AlertItem icon={Clock} label="Vėluojantys follow-up" count={overdueFollowUps} color="red" to="/pipeline" />
        )}
        {noNextAction > 0 && (
          <AlertItem icon={UserX} label="Lead'ai be sekančio veiksmo" count={noNextAction} color="orange" to="/pipeline" />
        )}
        {noContact24h > 0 && (
          <AlertItem icon={AlertTriangle} label="Nauji lead'ai be kontakto >24h" count={noContact24h} color="amber" to="/pipeline" />
        )}
        {stuckLeads > 0 && (
          <AlertItem icon={TrendingDown} label="Užstrigę etapuose" count={stuckLeads} color="orange" to="/pipeline" />
        )}
      </div>
    </div>
  );
}