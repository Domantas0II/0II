import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function UserStatusBadge({ status }) {
  const config = {
    active: { label: 'Aktyvus', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    disabled: { label: 'Išjungtas', className: 'bg-red-50 text-red-700 border-red-200' },
    pending: { label: 'Laukia pakvietimo', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    expired: { label: 'Pasibaigęs', className: 'bg-gray-50 text-gray-500 border-gray-200' },
    revoked: { label: 'Atšauktas', className: 'bg-gray-50 text-gray-500 border-gray-200' },
    accepted: { label: 'Priimtas', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };

  const c = config[status] || config.active;

  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium border', c.className)}>
      {c.label}
    </Badge>
  );
}