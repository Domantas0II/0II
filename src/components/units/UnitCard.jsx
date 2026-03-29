import React from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import UnitStatusBadge from './UnitStatusBadge';
import { UNIT_TYPE_LABELS, UNIT_STATUS_LABELS } from '@/lib/unitConstants';
import { canManageUnits } from '@/lib/constants';
import { cn } from '@/lib/utils';

const TYPE_ICONS = { apartment: '🏢', house: '🏡', townhouse: '🏘️' };

export default function UnitCard({ unit, projectName, currentUser, onStatusChange }) {
  const canManage = canManageUnits(currentUser?.role);

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/20 hover:shadow-sm transition-all duration-200">
      {/* Icon */}
      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg">
        {TYPE_ICONS[unit.type] || '🏠'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/units/${unit.id}`} className="text-sm font-bold hover:underline">{unit.label}</Link>
          <span className="text-xs text-muted-foreground">{UNIT_TYPE_LABELS[unit.type]}</span>
          <UnitStatusBadge status={unit.internalStatus} />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
          {projectName && <span>{projectName}</span>}
          <span>{unit.areaM2} m²</span>
          {unit.roomsCount && <span>{unit.roomsCount} kamb.</span>}
          {unit.floor && <span>{unit.floor} aukštas</span>}
        </div>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0 hidden sm:block">
        <p className="text-sm font-bold">{unit.price?.toLocaleString('lt-LT')} €</p>
        <p className="text-xs text-muted-foreground">{unit.pricePerM2?.toLocaleString('lt-LT')} €/m²</p>
      </div>

      {/* Actions */}
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/units/${unit.id}`}>Peržiūrėti</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.entries(UNIT_STATUS_LABELS).map(([k, v]) => (
              unit.internalStatus !== k && (
                <DropdownMenuItem key={k} onClick={() => onStatusChange(unit, k)}>
                  → {v}
                </DropdownMenuItem>
              )
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}