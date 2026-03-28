import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import {
  COMPONENT_TYPE_LABELS, COMPONENT_STATUS_LABELS,
  PARKING_PLACEMENT_LABELS, PARKING_USE_TYPE_LABELS, LAND_TYPE_LABELS
} from '@/lib/unitConstants';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  available: 'bg-green-50 text-green-700 border-green-200',
  reserved: 'bg-amber-50 text-amber-700 border-amber-200',
  sold: 'bg-slate-100 text-slate-500 border-slate-200',
  withheld: 'bg-orange-50 text-orange-700 border-orange-200',
};

function getSubLabel(comp) {
  if (comp.type === 'parking') {
    const parts = [];
    if (comp.parkingPlacement) parts.push(PARKING_PLACEMENT_LABELS[comp.parkingPlacement]);
    if (comp.parkingUseType) parts.push(PARKING_USE_TYPE_LABELS[comp.parkingUseType]);
    return parts.join(', ');
  }
  if (comp.type === 'land') {
    const parts = [];
    if (comp.landType) parts.push(LAND_TYPE_LABELS[comp.landType]);
    if (comp.landAreaAres) parts.push(`${comp.landAreaAres} a`);
    return parts.join(', ');
  }
  if (comp.type === 'storage') {
    return comp.storageAreaM2 ? `${comp.storageAreaM2} m²` : '';
  }
  return '';
}

export default function ComponentRow({ component, canManage, onDetach }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{component.label}</span>
          <Badge variant="outline" className="text-[10px]">{COMPONENT_TYPE_LABELS[component.type]}</Badge>
          <Badge variant="outline" className={cn('text-[10px] border', STATUS_COLORS[component.status] || '')}>
            {COMPONENT_STATUS_LABELS[component.status]}
          </Badge>
          {component.includedInPrice ? (
            <span className="text-[10px] text-muted-foreground">įskaičiuota</span>
          ) : (
            <span className="text-[10px] font-medium text-foreground">
              {component.price ? `${component.price?.toLocaleString('lt-LT')} €` : ''}
            </span>
          )}
        </div>
        {getSubLabel(component) && (
          <p className="text-xs text-muted-foreground mt-0.5">{getSubLabel(component)}</p>
        )}
      </div>
      {canManage && onDetach && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDetach(component)}>
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}