import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS, ACTIVITY_TYPE_ICONS } from '@/lib/pipelineConstants';

export default function ActivityRow({ activity, projectName, onMarkDone, onCancel }) {
  const isDone = activity.status === 'done';
  const isCancelled = activity.status === 'cancelled';

  return (
    <div className={`p-3 rounded-lg border ${isDone ? 'bg-green-50 border-green-200' : isCancelled ? 'bg-red-50 border-red-200' : 'bg-card'}`}>
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="text-xl flex-shrink-0 pt-0.5">{ACTIVITY_TYPE_ICONS[activity.type]}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{ACTIVITY_TYPE_LABELS[activity.type]}</p>
            {projectName && (
              <Badge variant="secondary" className="text-[10px]">
                {projectName}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {ACTIVITY_STATUS_LABELS[activity.status]}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {activity.scheduledAt ? format(new Date(activity.scheduledAt), 'yyyy-MM-dd HH:mm') : 'Nėra datos'}
          </p>

          {activity.notes && (
            <p className="text-xs mt-1 text-foreground">{activity.notes}</p>
          )}
        </div>

        {/* Actions */}
        {!isDone && !isCancelled && (
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => onMarkDone(activity.id)}
              title="Mark done"
            >
              <Circle className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive"
              onClick={() => onCancel(activity.id)}
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}