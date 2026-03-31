import React from 'react';
import React from 'react';
import FieldGroup from '@/components/projects/FieldGroup';
import MultiSelect from '@/components/projects/MultiSelect';
import { UNIT_TYPE_LABELS, STRUCTURE_MODEL_LABELS } from '@/lib/projectConstants';

const UNIT_OPTIONS = Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }));

export default function StepInventory({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <FieldGroup label="Objektų tipai" required hint="Kokie objektų tipai bus šiame projekte">
        <MultiSelect
          options={UNIT_OPTIONS}
          value={data.unitTypesEnabled || []}
          onChange={v => set('unitTypesEnabled', v)}
        />
      </FieldGroup>

      <FieldGroup label="Struktūros modelis" required hint="Kaip projektas yra organizuotas viduje">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(STRUCTURE_MODEL_LABELS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => set('structureModel', k)}
              className={`p-3 rounded-lg border text-sm font-medium text-left transition-all ${
                data.structureModel === k
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary/40'
              }`}
            >
              <span className="block font-semibold">{v}</span>
              <span className="block text-xs opacity-70 mt-0.5">
                {k === 'none' && 'Visi objektai vienoje grupėje'}
                {k === 'buildings' && 'Atskiri korpusai'}
                {k === 'sections' && 'Sekcijos viename korpuse'}
                {k === 'phases' && 'Statybos etapai'}
                {k === 'mixed' && 'Kelių lygių struktūra'}
              </span>
            </button>
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}