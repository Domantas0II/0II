import React from 'react';
import { Badge } from '@/components/ui/badge';
import PipelineCard from './PipelineCard';
import { PIPELINE_STAGE_LABELS, STAGE_COLORS, STAGE_BORDER_COLORS } from '@/lib/pipelineConstants';

export default function PipelineColumn({ stage, interests, projects, units, activities, onCall, onStageChange, saving }) {
  const stageInterests = interests.filter(i => i.pipelineStage === stage);
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));
  const activityMap = Object.fromEntries(activities.map(a => [a.clientId, a]));

  const bgClass = STAGE_COLORS[stage] || 'bg-slate-50';
  const borderClass = STAGE_BORDER_COLORS[stage] || 'border-slate-200';

  return (
    <div className={`flex-shrink-0 w-[280px] sm:w-[300px] rounded-lg border-2 ${borderClass} ${bgClass} flex flex-col max-h-[calc(100vh-220px)]`}>
      {/* Column header */}
      <div className="p-3 border-b border-black/5 flex items-center justify-between sticky top-0 backdrop-blur-sm">
        <h3 className="font-semibold text-sm">{PIPELINE_STAGE_LABELS[stage] || stage}</h3>
        <Badge variant="secondary" className="text-xs">{stageInterests.length}</Badge>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {stageInterests.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 opacity-50">Tuščia</p>
        ) : (
          stageInterests.map(interest => (
            <PipelineCard
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