import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, ArrowRight, Clock, AlertCircle, Calendar, User } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ACTIVITY_TYPE_ICONS, STAGE_OVERDUE_THRESHOLD_DAYS, PIPELINE_STAGE_LABELS } from '@/lib/pipelineConstants';
import CallModal from './CallModal';
import StageChangeModal from './StageChangeModal';

function getPriorityIndicator(interest) {
  const now = new Date();
  // Red: follow-up overdue
  if (interest.nextFollowUpAt && new Date(interest.nextFollowUpAt) < now) {
    return { color: 'bg-red-500', label: 'Vėluoja' };
  }
  // Red: stage stuck too long
  const threshold = STAGE_OVERDUE_THRESHOLD_DAYS[interest.pipelineStage] || 7;
  const stageDate = interest.stageUpdatedAt ? new Date(interest.stageUpdatedAt) : new Date(interest.created_date || now);
  if (differenceInDays(now, stageDate) > threshold) {
    return { color: 'bg-red-500', label: 'Vėluoja' };
  }
  // Yellow: follow-up today
  if (interest.nextFollowUpAt) {
    const fuDate = new Date(interest.nextFollowUpAt);
    if (
      fuDate.getFullYear() === now.getFullYear() &&
      fuDate.getMonth() === now.getMonth() &&
      fuDate.getDate() === now.getDate()
    ) {
      return { color: 'bg-yellow-400', label: 'Šiandien' };
    }
  }
  return { color: 'bg-green-400', label: 'Tvarkoje' };
}

function getStageDays(interest) {
  const from = interest.stageUpdatedAt || interest.created_date;
  if (!from) return null;
  return differenceInDays(new Date(), new Date(from));
}

export default function PipelineCard({ interest, project, unit, lastActivity, onCall, onStageChange, saving }) {
  const [callOpen, setCallOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);

  const priority = getPriorityIndicator(interest);
  const stageDays = getStageDays(interest);

  const handleCall = (data) => {
    onCall(interest, data);
    setCallOpen(false);
  };

  const handleStageChange = (data) => {
    onStageChange(interest, data);
    setStageOpen(false);
  };

  return (
    <>
      <div className="p-3 bg-white rounded-lg border hover:shadow-md transition-shadow">
        {/* Priority dot + client name */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priority.color}`} title={priority.label} />
            <p className="font-semibold text-sm truncate">{interest.fullName}</p>
          </div>
          {stageDays !== null && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
              {stageDays}d etape
            </span>
          )}
        </div>

        {/* Project + unit */}
        <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
          <p className="truncate font-medium text-foreground/70">{project?.projectName || project?.projectCode || '—'}</p>
          {unit && <p className="truncate">🏠 {unit.label}</p>}
        </div>

        {/* Manager */}
        {interest.assignedManagerUserId && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
            <User className="h-3 w-3" />
            <span className="truncate">{interest.managerName || 'Priskirtas'}</span>
          </div>
        )}

        {/* Last activity */}
        {lastActivity && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 pb-2 border-t pt-2">
            <span>{ACTIVITY_TYPE_ICONS[lastActivity.type] || '📝'}</span>
            <span>{format(new Date(lastActivity.completedAt || lastActivity.scheduledAt || lastActivity.created_date), 'MM-dd')}</span>
            {lastActivity.notes && (
              <span className="truncate text-[10px] opacity-70">{lastActivity.notes}</span>
            )}
          </div>
        )}

        {/* Next follow-up */}
        {interest.nextFollowUpAt && (
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded mb-2 ${
            new Date(interest.nextFollowUpAt) < new Date()
              ? 'bg-red-50 text-red-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>FU: {format(new Date(interest.nextFollowUpAt), 'MM-dd')}</span>
          </div>
        )}

        {/* CTA buttons */}
        <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t">
          <Button
            size="sm"
            className="h-8 text-xs gap-1 w-full"
            onClick={() => setCallOpen(true)}
          >
            <Phone className="h-3.5 w-3.5" /> Skambinti
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 w-full"
            onClick={() => setStageOpen(true)}
          >
            <ArrowRight className="h-3.5 w-3.5" /> Keisti etapą
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs col-span-2 w-full"
            asChild
          >
            <Link to={`/clients/${interest.clientId}`}>Atidaryti klientą</Link>
          </Button>
        </div>
      </div>

      <CallModal
        open={callOpen}
        onClose={() => setCallOpen(false)}
        onSave={handleCall}
        interest={interest}
        saving={saving}
      />
      <StageChangeModal
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        onSave={handleStageChange}
        interest={interest}
        saving={saving}
      />
    </>
  );
}