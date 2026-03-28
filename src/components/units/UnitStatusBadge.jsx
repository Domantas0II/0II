import React from 'react';
import { Badge } from '@/components/ui/badge';
import { UNIT_STATUS_LABELS, UNIT_STATUS_COLORS } from '@/lib/unitConstants';
import { cn } from '@/lib/utils';

export default function UnitStatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium border', UNIT_STATUS_COLORS[status] || '')}>
      {UNIT_STATUS_LABELS[status] || status}
    </Badge>
  );
}