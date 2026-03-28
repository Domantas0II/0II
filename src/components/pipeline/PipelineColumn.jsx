import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PipelineCard from './PipelineCard';
import { PIPELINE_STAGE_LABELS, STAGE_COLORS, STAGE_BORDER_COLORS } from '@/lib/pipelineConstants';

export default function PipelineColumn({ stage, interests, projects, units, activities, onDragOver, onDrop }) {
  const stageInterests = interests.filter(i => i.pipelineStage === stage);
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));
  const activityMap = Object.fromEntries(
    activities.map(a => [a.clientId, a])
  );

  const now = new Date();

  return (
    <div
      className={`flex-1 min-w-[300px] p-3 rounded-lg border-2 ${STAGE_BORDER_COLORS[stage]} ${STAGE_COLORS[stage]}`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage)}
    >
      <h3 className="font-semibold text-sm mb-1">{PIPELINE_STAGE_LABELS[stage]}</h3>
      <Badge variant="secondary" className="text-xs mb-3">{stageInterests.length}</Badge>

      <div className="space-y-2">
        {stageInterests.map(interest => {
          const lastActivity = activityMap[interest.clientId];
          const isOverdue = interest.nextFollowUpAt && new Date(interest.nextFollowUpAt) <= now;

          return (
            <div
              key={interest.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('interestId', interest.id)}
              className="cursor-move"
            >
              <PipelineCard
                interest={interest}
                project={projectMap[interest.projectId]}
                unit={interest.unitId ? unitMap[interest.unitId] : null}
                lastActivity={lastActivity}
                isOverdue={isOverdue}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}