import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Phone, ArrowRight, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  PIPELINE_STAGES, PIPELINE_STAGE_LABELS,
  STAGE_OVERDUE_THRESHOLD_DAYS, ACTIVITY_TYPE_ICONS
} from '@/lib/pipelineConstants';
import CallModal from './CallModal';
import StageChangeModal from './StageChangeModal';

function getPriority(interest) {
  const now = new Date();
  if (interest.nextFollowUpAt && new Date(interest.nextFollowUpAt) < now)
    return { dot: 'bg-red-500', label: 'Vėluoja', textClass: 'text-red-600' };
  const threshold = STAGE_OVERDUE_THRESHOLD_DAYS[interest.pipelineStage] || 7;
  const from = interest.stageUpdatedAt || interest.created_date;
  if (from && differenceInDays(now, new Date(from)) > threshold)
    return { dot: 'bg-red-500', label: 'Vėluoja', textClass: 'text-red-600' };
  if (interest.nextFollowUpAt) {
    const fu = new Date(interest.nextFollowUpAt);
    const sameDay = fu.toDateString() === now.toDateString();
    if (sameDay) return { dot: 'bg-yellow-400', label: 'Šiandien', textClass: 'text-yellow-600' };
  }
  return { dot: 'bg-green-400', label: 'Tvarkoje', textClass: 'text-green-600' };
}

function getStageDays(interest) {
  const from = interest.stageUpdatedAt || interest.created_date;
  if (!from) return null;
  return differenceInDays(new Date(), new Date(from));
}

function MobileCard({ interest, project, unit, lastActivity, onCall, onStageChange, saving }) {
  const [callOpen, setCallOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const priority = getPriority(interest);
  const stageDays = getStageDays(interest);

  return (
    <>
      <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${priority.dot}`} />
            <p className="font-semibold text-base truncate">{interest.fullName}</p>
          </div>
          <span className={`text-xs font-medium ${priority.textClass} flex-shrink-0`}>{priority.label}</span>
        </div>

        {/* Project + unit */}
        <div className="text-sm text-muted-foreground space-y-0.5">
          <p className="font-medium text-foreground/80 truncate">{project?.projectName || '—'}</p>
          {unit && <p className="truncate">🏠 {unit.label}</p>}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {stageDays !== null && (
            <span className="flex items-center gap-1">⏱ {stageDays} d. etape</span>
          )}
          {interest.managerName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />{interest.managerName}
            </span>
          )}
          {lastActivity && (
            <span className="flex items-center gap-1">
              {ACTIVITY_TYPE_ICONS[lastActivity.type] || '📝'}
              {format(new Date(lastActivity.completedAt || lastActivity.scheduledAt || lastActivity.created_date), 'MM-dd')}
            </span>
          )}
        </div>

        {/* Follow-up */}
        {interest.nextFollowUpAt && (
          <div className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg ${
            new Date(interest.nextFollowUpAt) < new Date()
              ? 'bg-red-50 text-red-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>Veiksmas: {format(new Date(interest.nextFollowUpAt), 'yyyy-MM-dd')}</span>
          </div>
        )}

        {/* CTA */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button size="default" className="h-11 text-sm gap-2" onClick={() => setCallOpen(true)}>
            <Phone className="h-4 w-4" /> Skambinti
          </Button>
          <Button size="default" variant="outline" className="h-11 text-sm gap-2" onClick={() => setStageOpen(true)}>
            <ArrowRight className="h-4 w-4" /> Etapas
          </Button>
          <Button size="default" variant="ghost" className="h-11 text-sm col-span-2" asChild>
            <Link to={`/clients/${interest.clientId}`}>Atidaryti klientą</Link>
          </Button>
        </div>
      </div>

      <CallModal open={callOpen} onClose={() => setCallOpen(false)} onSave={(d) => { onCall(interest, d); setCallOpen(false); }} interest={interest} saving={saving} />
      <StageChangeModal open={stageOpen} onClose={() => setStageOpen(false)} onSave={(d) => { onStageChange(interest, d); setStageOpen(false); }} interest={interest} saving={saving} />
    </>
  );
}

export default function PipelineMobileView({ interests, projects, units, activities, onCall, onStageChange, saving }) {
  const [selectedStage, setSelectedStage] = useState(PIPELINE_STAGES[0]);

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));
  const activityMap = Object.fromEntries(activities.map(a => [a.clientId, a]));

  const stageInterests = interests.filter(i => i.pipelineStage === selectedStage);
  const currentIdx = PIPELINE_STAGES.indexOf(selectedStage);

  const prevStage = currentIdx > 0 ? PIPELINE_STAGES[currentIdx - 1] : null;
  const nextStage = currentIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[currentIdx + 1] : null;

  // Counts per stage for the dropdown
  const countByStage = {};
  PIPELINE_STAGES.forEach(s => {
    countByStage[s] = interests.filter(i => i.pipelineStage === s).length;
  });

  return (
    <div className="space-y-4">
      {/* Stage selector */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          disabled={!prevStage}
          onClick={() => prevStage && setSelectedStage(prevStage)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select value={selectedStage} onValueChange={setSelectedStage}>
          <SelectTrigger className="flex-1 h-10 text-sm font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE_STAGES.map(s => (
              <SelectItem key={s} value={s}>
                {PIPELINE_STAGE_LABELS[s]}
                {countByStage[s] > 0 && (
                  <span className="ml-2 text-muted-foreground">({countByStage[s]})</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          disabled={!nextStage}
          onClick={() => nextStage && setSelectedStage(nextStage)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Stage count badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {stageInterests.length === 0 ? 'Tuščia' :
            stageInterests.length === 1 ? '1 klientas' :
            `${stageInterests.length} klientai`}
        </Badge>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {stageInterests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <p className="text-3xl mb-3">🎉</p>
            <p>Šiame etape klientų nėra</p>
          </div>
        ) : (
          stageInterests.map(interest => (
            <MobileCard
              key={interest.id}
              interest={interest}
              project={projectMap[interest.projectId]}
              unit={interest.unitId ? unitMap[interest.unitId] : null}
              lastActivity={activityMap[interest.clientId]}
              onCall={onCall}
              onStageChange={onStageChange}
              saving={saving}
            />
          ))
        )}
      </div>
    </div>
  );
}