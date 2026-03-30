import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Phone, ArrowRight, Calendar, User } from 'lucide-react';
import { format, differenceInDays, isToday, isYesterday } from 'date-fns';
import { ACTIVITY_TYPE_ICONS, STAGE_OVERDUE_THRESHOLD_DAYS, CALL_TIME_VISIBLE_STAGES } from '@/lib/pipelineConstants';
import CallModal from './CallModal';
import StageChangeModal from './StageChangeModal';

function getPriorityIndicator(interest) {
  const now = new Date();
  if (interest.nextFollowUpAt && new Date(interest.nextFollowUpAt) < now)
    return { color: 'bg-red-500', label: 'Vėluoja' };
  const threshold = STAGE_OVERDUE_THRESHOLD_DAYS[interest.pipelineStage] || 7;
  const stageDate = interest.stageUpdatedAt ? new Date(interest.stageUpdatedAt) : new Date(interest.created_date || now);
  if (differenceInDays(now, stageDate) > threshold)
    return { color: 'bg-red-500', label: 'Vėluoja' };
  if (interest.nextFollowUpAt) {
    const fuDate = new Date(interest.nextFollowUpAt);
    if (fuDate.toDateString() === now.toDateString())
      return { color: 'bg-yellow-400', label: 'Šiandien' };
  }
  return { color: 'bg-green-400', label: 'Tvarkoje' };
}

function getStageDays(interest) {
  const from = interest.stageUpdatedAt || interest.created_date;
  if (!from) return null;
  return differenceInDays(new Date(), new Date(from));
}

function formatCallTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isToday(d)) return `Šiandien ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Vakar ${format(d, 'HH:mm')}`;
  return format(d, 'yyyy-MM-dd HH:mm');
}

export default function PipelineCard({ interest, project, unit, lastActivity, onCall, onStageChange, saving }) {
  const [callOpen, setCallOpen] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [stageOpen, setStageOpen] = useState(false);
  const pendingCall = useRef(false);

  const priority = getPriorityIndicator(interest);
  const stageDays = getStageDays(interest);

  const showCallTime = CALL_TIME_VISIBLE_STAGES.has(interest.pipelineStage);
  const lastCallTime = showCallTime && lastActivity?.type === 'call'
    ? formatCallTime(lastActivity.startedAt || lastActivity.completedAt || lastActivity.created_date)
    : null;

  // Open modal when user returns to the app after the call
  useEffect(() => {
    const handleReturn = () => {
      if (pendingCall.current) {
        pendingCall.current = false;
        setCallOpen(true);
      }
    };
    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleReturn);
    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleReturn);
    };
  }, []);

  const handleCallClick = () => {
    const now = new Date().toISOString();
    setCallStartedAt(now);
    pendingCall.current = true;
    if (interest.phone) {
      window.location.href = `tel:${interest.phone}`;
    } else {
      // No phone — open modal immediately
      pendingCall.current = false;
      setCallOpen(true);
    }
  };

  const handleCallSave = (data) => {
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
        {interest.managerName && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
            <User className="h-3 w-3" />
            <span className="truncate">{interest.managerName}</span>
          </div>
        )}

        {/* Last call time — only for early stages */}
        {lastCallTime && (
          <div className="flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{lastCallTime}</span>
          </div>
        )}

        {/* Last activity (non-call or if not early stage) */}
        {lastActivity && !lastCallTime && (
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
            className="h-8 text-xs gap-1 w-full bg-green-600 hover:bg-green-700"
            onClick={handleCallClick}
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
        onSave={handleCallSave}
        interest={interest}
        saving={saving}
        callStartedAt={callStartedAt}
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