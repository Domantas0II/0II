import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const ROLE_COLORS = {
  ADMINISTRATOR: 'bg-primary/10 text-primary border-primary/20',
  SALES_MANAGER: 'bg-blue-50 text-blue-700 border-blue-200',
  SALES_AGENT: 'bg-violet-50 text-violet-700 border-violet-200',
  PROJECT_DEVELOPER: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

export default function RoleBadge({ role }) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium border', ROLE_COLORS[role] || 'bg-muted text-muted-foreground')}>
      {ROLE_LABELS[role] || role}
    </Badge>
  );
}