import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldGroup from '@/components/projects/FieldGroup';
import { PROJECT_TYPE_LABELS, PROJECT_STAGE_LABELS } from '@/lib/projectConstants';

export default function StepBase({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Projekto pavadinimas" required>
          <Input
            placeholder="pvz. Saulėtekio rezidencija"
            value={data.projectName || ''}
            onChange={e => set('projectName', e.target.value)}
          />
        </FieldGroup>
        <FieldGroup label="Projekto kodas" required hint="Unikalus trumpas identifikatorius">
          <Input
            placeholder="pvz. SAUL-2025"
            value={data.projectCode || ''}
            onChange={e => set('projectCode', e.target.value.toUpperCase())}
          />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Projekto tipas" required>
          <Select value={data.projectType || ''} onValueChange={v => set('projectType', v)}>
            <SelectTrigger><SelectValue placeholder="Pasirinkite..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Statybos stadija" required>
          <Select value={data.projectStage || ''} onValueChange={v => set('projectStage', v)}>
            <SelectTrigger><SelectValue placeholder="Pasirinkite..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STAGE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FieldGroup label="Miestas" required>
          <Input
            placeholder="pvz. Vilnius"
            value={data.city || ''}
            onChange={e => set('city', e.target.value)}
          />
        </FieldGroup>
        <FieldGroup label="Rajonas" required>
          <Input
            placeholder="pvz. Antakalnis"
            value={data.district || ''}
            onChange={e => set('district', e.target.value)}
          />
        </FieldGroup>
        <FieldGroup label="Adresas" required>
          <Input
            placeholder="pvz. Saulėtekio al. 15"
            value={data.address || ''}
            onChange={e => set('address', e.target.value)}
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Vystytojo pavadinimas" required>
        <Input
          placeholder="pvz. UAB Saulėtekio plėtra"
          value={data.developerName || ''}
          onChange={e => set('developerName', e.target.value)}
        />
      </FieldGroup>
    </div>
  );
}