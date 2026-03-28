import React from 'react';
import { Switch } from '@/components/ui/switch';
import FieldGroup from '@/components/projects/FieldGroup';
import MultiSelect from '@/components/projects/MultiSelect';
import {
  COMPONENT_LABELS, LAND_TYPE_LABELS,
  PARKING_PLACEMENT_LABELS, PARKING_TYPE_LABELS
} from '@/lib/projectConstants';

const COMPONENT_OPTIONS = Object.entries(COMPONENT_LABELS).map(([k, v]) => ({ value: k, label: v }));
const LAND_OPTIONS = Object.entries(LAND_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }));
const PARKING_PLACEMENT_OPTIONS = Object.entries(PARKING_PLACEMENT_LABELS).map(([k, v]) => ({ value: k, label: v }));
const PARKING_TYPE_OPTIONS = Object.entries(PARKING_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }));

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function StepComponents({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });
  const enabled = data.componentsEnabled || [];
  const hasLand = enabled.includes('land');
  const hasParking = enabled.includes('parking');
  const hasStorage = enabled.includes('storage');

  return (
    <div className="space-y-6">
      <FieldGroup label="Aktyvios dedamosios" hint="Kurios dedamosios gali būti susietos su objektais">
        <MultiSelect
          options={COMPONENT_OPTIONS}
          value={enabled}
          onChange={v => set('componentsEnabled', v)}
        />
      </FieldGroup>

      {hasLand && (
        <div className="space-y-3 pl-4 border-l-2 border-primary/20">
          <p className="text-sm font-semibold text-primary">Žemė</p>
          <MultiSelect
            label="Žemės nuosavybės tipai"
            options={LAND_OPTIONS}
            value={data.landTypes || []}
            onChange={v => set('landTypes', v)}
          />
          <ToggleRow
            label="Žemė įskaičiuota į kainą"
            checked={data.landIncludedInPriceDefault}
            onChange={v => set('landIncludedInPriceDefault', v)}
          />
        </div>
      )}

      {hasParking && (
        <div className="space-y-3 pl-4 border-l-2 border-primary/20">
          <p className="text-sm font-semibold text-primary">Parkavimas</p>
          <MultiSelect
            label="Vieta"
            options={PARKING_PLACEMENT_OPTIONS}
            value={data.parkingPlacement || []}
            onChange={v => set('parkingPlacement', v)}
          />
          <MultiSelect
            label="Tipai"
            options={PARKING_TYPE_OPTIONS}
            value={data.parkingTypes || []}
            onChange={v => set('parkingTypes', v)}
          />
          <ToggleRow
            label="Parkavimas įskaičiuotas į kainą"
            checked={data.parkingIncludedInPriceDefault}
            onChange={v => set('parkingIncludedInPriceDefault', v)}
          />
        </div>
      )}

      {hasStorage && (
        <div className="space-y-3 pl-4 border-l-2 border-primary/20">
          <p className="text-sm font-semibold text-primary">Sandėlis</p>
          <ToggleRow
            label="Sandėlis įskaičiuotas į kainą"
            checked={data.storageIncludedInPriceDefault}
            onChange={v => set('storageIncludedInPriceDefault', v)}
          />
        </div>
      )}
    </div>
  );
}