import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import FieldGroup from '@/components/projects/FieldGroup';
import MultiSelect from '@/components/projects/MultiSelect';
import {
  BUILDING_TYPE_LABELS, HEATING_TYPE_LABELS,
  INSTALLATION_STATUS_LABELS, ENERGY_CLASS_LABELS
} from '@/lib/projectConstants';

const BUILDING_OPTIONS = Object.entries(BUILDING_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }));
const HEATING_OPTIONS = Object.entries(HEATING_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }));

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

export default function StepTechnical({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <MultiSelect
        label="Pastato konstrukcija"
        options={BUILDING_OPTIONS}
        value={data.buildingType || []}
        onChange={v => set('buildingType', v)}
      />
      <MultiSelect
        label="Šildymo tipas"
        options={HEATING_OPTIONS}
        value={data.heatingType || []}
        onChange={v => set('heatingType', v)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Įrengimo lygis">
          <Select value={data.installationStatus || ''} onValueChange={v => set('installationStatus', v)}>
            <SelectTrigger><SelectValue placeholder="Pasirinkite..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(INSTALLATION_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Energetinė klasė">
          <Select value={data.energyClass || ''} onValueChange={v => set('energyClass', v)}>
            <SelectTrigger><SelectValue placeholder="Pasirinkite..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(ENERGY_CLASS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>

      <FieldGroup label="Statybos metai" hint="Numatomas arba faktinis baigimo metai">
        <Input
          type="number"
          placeholder="pvz. 2026"
          min={2000}
          max={2040}
          value={data.constructionYear || ''}
          onChange={e => set('constructionYear', parseInt(e.target.value) || '')}
          className="w-40"
        />
      </FieldGroup>

      <div className="space-y-2">
        <p className="text-sm font-medium">Numatytieji objektų laukai</p>
        <div className="space-y-2">
          <ToggleRow label="Balkonas (numatytai)" checked={data.hasBalconyDefault} onChange={v => set('hasBalconyDefault', v)} />
          <ToggleRow label="Terasa (numatytai)" checked={data.hasTerraceDefault} onChange={v => set('hasTerraceDefault', v)} />
          <ToggleRow label="Naudoti kambarių skaičių" checked={data.useRoomsCount} onChange={v => set('useRoomsCount', v)} />
          <ToggleRow label="Naudoti vonios kambarių skaičių" checked={data.useBathroomsCount} onChange={v => set('useBathroomsCount', v)} />
          <ToggleRow label="Naudoti langų kryptis" checked={data.useWindowDirections} onChange={v => set('useWindowDirections', v)} />
        </div>
      </div>
    </div>
  );
}