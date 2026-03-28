import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ACTIVITY_TYPE_ICONS } from '@/lib/pipelineConstants';

export default function PipelineCard({ interest, project, unit, lastActivity, isOverdue }) {
  return (
    <Link to={`/clients/${interest.clientId}`}>
      <div className="p-3 bg-white rounded-lg border hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{interest.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{project?.projectCode}</p>
          </div>
          {isOverdue && <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />}
        </div>

        {/* Unit if exists */}
        {unit && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            🏠 {unit.label}
          </p>
        )}

        {/* Last activity */}
        {lastActivity && (
          <div className="text-xs text-muted-foreground mb-2 pb-2 border-t">
            <div className="flex items-center gap-1 mt-1">
              <span>{ACTIVITY_TYPE_ICONS[lastActivity.type]}</span>
              <span className="truncate">
                {format(new Date(lastActivity.scheduledAt || lastActivity.created_date), 'MM-dd')}
              </span>
            </div>
          </div>
        )}

        {/* Next follow-up */}
        {interest.nextFollowUpAt && (
          <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
            <Clock className="h-3 w-3" />
            <span>FU: {format(new Date(interest.nextFollowUpAt), 'MM-dd')}</span>
          </div>
        )}
      </div>
    </Link>
  );
}