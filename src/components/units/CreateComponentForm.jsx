import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import FieldGroup from '@/components/projects/FieldGroup';
import {
  COMPONENT_TYPE_LABELS, PARKING_PLACEMENT_LABELS,
  PARKING_USE_TYPE_LABELS, LAND_TYPE_LABELS
} from '@/lib/unitConstants';
import { Loader2 } from 'lucide-react';

// projectId — optional. Jei nepateiktas, rodomas projekto pasirinkimas (pool kūrimas).
// projects — reikalingas tik kai projectId nėra.
export default function CreateComponentForm({ projectId, projects = [], onSubmit, onCancel, saving }) {
  const [data, setData] = useState({ projectId: projectId || '', status: 'available', includedInPrice: true });
  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Projektas — tik kai nėra fiksuoto projectId */}
      {!projectId && (
        <FieldGroup label="Projektas" required>
          <Select value={data.projectId || ''} onValueChange={v => set('projectId', v)}>
            <SelectTrigger><SelectValue placeholder="Pasirinkite projektą..." /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Tipas" required>
          <Select value={data.type || ''} onValueChange={v => set('type', v)}>
            <SelectTrigger><SelectValue placeholder="Tipas..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(COMPONENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Žymė" required hint="pvz. P-12">
          <Input placeholder="P12" value={data.label || ''} onChange={e => set('label', e.target.value.toUpperCase())} />
        </FieldGroup>
      </div>

      {/* Parking */}
      {data.type === 'parking' && (
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Vieta">
            <Select value={data.parkingPlacement || ''} onValueChange={v => set('parkingPlacement', v)}>
              <SelectTrigger><SelectValue placeholder="Vieta..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(PARKING_PLACEMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Tipas">
            <Select value={data.parkingUseType || ''} onValueChange={v => set('parkingUseType', v)}>
              <SelectTrigger><SelectValue placeholder="Tipas..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(PARKING_USE_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
      )}

      {/* Land */}
      {data.type === 'land' && (
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Nuosavybės tipas">
            <Select value={data.landType || ''} onValueChange={v => set('landType', v)}>
              <SelectTrigger><SelectValue placeholder="Tipas..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(LAND_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Plotas (arai)">
            <Input type="number" min={0} placeholder="0" value={data.landAreaAres || ''} onChange={e => set('landAreaAres', parseFloat(e.target.value) || '')} />
          </FieldGroup>
        </div>
      )}

      {/* Storage */}
      {data.type === 'storage' && (
        <FieldGroup label="Plotas m²">
          <Input type="number" min={0} placeholder="0" value={data.storageAreaM2 || ''} onChange={e => set('storageAreaM2', parseFloat(e.target.value) || '')} className="w-32" />
        </FieldGroup>
      )}

      {/* Price */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <p className="text-sm font-medium">Įskaičiuota į objekto kainą</p>
        <Switch checked={!!data.includedInPrice} onCheckedChange={v => set('includedInPrice', v)} />
      </div>
      {!data.includedInPrice && (
        <FieldGroup label="Atskira kaina €">
          <Input type="number" min={0} placeholder="0" value={data.price || ''} onChange={e => set('price', parseFloat(e.target.value) || '')} className="w-40" />
        </FieldGroup>
      )}

      <div className="flex gap-3 justify-end pt-3 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Atšaukti</Button>
        <Button type="submit" disabled={saving || !data.type || !data.label || !data.projectId}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Sukurti
        </Button>
      </div>
    </form>
  );
}