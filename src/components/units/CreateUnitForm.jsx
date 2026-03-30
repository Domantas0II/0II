import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import FieldGroup from '@/components/projects/FieldGroup';
import { UNIT_TYPE_LABELS, WINDOW_DIRECTION_LABELS } from '@/lib/unitConstants';
import { INSTALLATION_STATUS_LABELS, ENERGY_CLASS_LABELS } from '@/lib/projectConstants';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DIRECTIONS = Object.entries(WINDOW_DIRECTION_LABELS);

function OverrideBadge({ overridden }) {
  if (!overridden) return null;
  return <span className="ml-1 text-[10px] text-amber-600 font-medium">override</span>;
}

export default function CreateUnitForm({ projects, technicalDefaults, onSubmit, onCancel, saving }) {
  const [data, setData] = useState({
    internalStatus: 'available',
    isPublic: false,
  });
  const [defaults, setDefaults] = useState({});

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  // Load project defaults when project selected
  useEffect(() => {
    if (!data.projectId || !technicalDefaults) return;
    const td = technicalDefaults[data.projectId];
    if (!td) return;
    const d = {
      installationStatus: td.installationStatus,
      energyClass: td.energyClass,
      constructionYear: td.constructionYear,
      hasBalcony: td.hasBalconyDefault,
      hasTerrace: td.hasTerraceDefault,
    };
    setDefaults(d);
    setData(prev => ({
      ...prev,
      installationStatus: prev._installationStatus_overridden ? prev.installationStatus : td.installationStatus,
      energyClass: prev._energyClass_overridden ? prev.energyClass : td.energyClass,
      constructionYear: prev._constructionYear_overridden ? prev.constructionYear : td.constructionYear,
      hasBalcony: prev._hasBalcony_overridden ? prev.hasBalcony : td.hasBalconyDefault,
      hasTerrace: prev._hasTerrace_overridden ? prev.hasTerrace : td.hasTerraceDefault,
    }));
  }, [data.projectId, technicalDefaults]);

  // Auto calc pricePerM2
  useEffect(() => {
    if (data.price && data.areaM2 && data.areaM2 > 0) {
      setData(prev => ({ ...prev, pricePerM2: Math.round(prev.price / prev.areaM2) }));
    }
  }, [data.price, data.areaM2]);

  const isOverridden = (key) => data[key] !== undefined && defaults[key] !== undefined && data[key] !== defaults[key];

  const isApartment = data.type === 'apartment';
  const isHouseOrTown = data.type === 'house' || data.type === 'townhouse';

  const toggleDirection = (dir) => {
    const curr = data.windowDirections || [];
    set('windowDirections', curr.includes(dir) ? curr.filter(d => d !== dir) : [...curr, dir]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith('_')));
    onSubmit(clean);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Project + type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup label="Projektas" required>
          <Select value={data.projectId || ''} onValueChange={v => set('projectId', v)}>
            <SelectTrigger><SelectValue placeholder="Pasirinkite projektą..." /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Objekto tipas" required>
          <Select value={data.type || ''} onValueChange={v => set('type', v)}>
            <SelectTrigger><SelectValue placeholder="Tipas..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>

      {/* Label */}
      <FieldGroup label="Žymė (label)" required hint="pvz. A-12, V01, NM-5">
        <Input placeholder="A12" value={data.label || ''} onChange={e => set('label', e.target.value.toUpperCase())} />
      </FieldGroup>

      {/* Area + Price */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <FieldGroup label="Plotas m²" required>
          <Input type="number" min={0} placeholder="0" value={data.areaM2 || ''} onChange={e => set('areaM2', parseFloat(e.target.value) || '')} />
        </FieldGroup>
        <FieldGroup label="Kaina €" required>
          <Input type="number" min={0} placeholder="0" value={data.price || ''} onChange={e => set('price', parseFloat(e.target.value) || '')} />
        </FieldGroup>
        <FieldGroup label="€/m²">
          <Input type="number" readOnly value={data.pricePerM2 || ''} className="bg-muted/50 cursor-default" />
        </FieldGroup>
      </div>

      {/* Rooms */}
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Kambariai" required>
          <Input type="number" min={1} placeholder="1" value={data.roomsCount || ''} onChange={e => set('roomsCount', parseInt(e.target.value) || '')} />
        </FieldGroup>
        <FieldGroup label="Vonios kambariai" required>
          <Input type="number" min={0} placeholder="1" value={data.bathroomsCount || ''} onChange={e => set('bathroomsCount', parseInt(e.target.value) || '')} />
        </FieldGroup>
      </div>

      {/* Floor — apartment only */}
      {isApartment && (
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Aukštas" required>
            <Input type="number" min={0} placeholder="1" value={data.floor || ''} onChange={e => set('floor', parseInt(e.target.value) || '')} />
          </FieldGroup>
          <FieldGroup label="Viso aukštų pastate">
            <Input type="number" min={0} placeholder="5" value={data.totalFloors || ''} onChange={e => set('totalFloors', parseInt(e.target.value) || '')} />
          </FieldGroup>
        </div>
      )}

      {/* floorsCount — house/townhouse */}
      {isHouseOrTown && (
        <FieldGroup label="Aukštų skaičius" required>
          <Input type="number" min={1} placeholder="2" value={data.floorsCount || ''} onChange={e => set('floorsCount', parseInt(e.target.value) || '')} />
        </FieldGroup>
      )}

      {/* Structure */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FieldGroup label="Korpusas">
          <Input placeholder="pvz. A" value={data.buildingName || ''} onChange={e => set('buildingName', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Sekcija">
          <Input placeholder="pvz. S1" value={data.sectionName || ''} onChange={e => set('sectionName', e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Etapas">
          <Input placeholder="pvz. I etapas" value={data.phaseName || ''} onChange={e => set('phaseName', e.target.value)} />
        </FieldGroup>
      </div>

      {/* Technical — with override indicators */}
      <div className="p-3 rounded-lg bg-muted/30 border space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Techniniai parametrai
          {defaults.installationStatus && <span className="ml-2 font-normal normal-case text-amber-600">← iš projekto</span>}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label={<>Įrengimas<OverrideBadge overridden={isOverridden('installationStatus')} /></>}>
            <Select value={data.installationStatus || ''} onValueChange={v => { set('installationStatus', v); set('_installationStatus_overridden', true); }}>
              <SelectTrigger><SelectValue placeholder="Pasirinkite..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(INSTALLATION_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label={<>Energetinė klasė<OverrideBadge overridden={isOverridden('energyClass')} /></>}>
            <Select value={data.energyClass || ''} onValueChange={v => { set('energyClass', v); set('_energyClass_overridden', true); }}>
              <SelectTrigger><SelectValue placeholder="Pasirinkite..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(ENERGY_CLASS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-3 p-2 rounded border bg-background">
            <span className="text-sm">Balkonas<OverrideBadge overridden={isOverridden('hasBalcony')} /></span>
            <Switch checked={!!data.hasBalcony} onCheckedChange={v => { set('hasBalcony', v); set('_hasBalcony_overridden', true); }} />
          </div>
          <div className="flex items-center gap-3 p-2 rounded border bg-background">
            <span className="text-sm">Terasa<OverrideBadge overridden={isOverridden('hasTerrace')} /></span>
            <Switch checked={!!data.hasTerrace} onCheckedChange={v => { set('hasTerrace', v); set('_hasTerrace_overridden', true); }} />
          </div>
        </div>
        {data.hasBalcony && (
          <FieldGroup label="Balkono plotas m²">
            <Input type="number" min={0} placeholder="0" value={data.balconyAreaM2 || ''} onChange={e => set('balconyAreaM2', parseFloat(e.target.value) || '')} className="w-32" />
          </FieldGroup>
        )}
        {data.hasTerrace && (
          <FieldGroup label="Terasos plotas m²">
            <Input type="number" min={0} placeholder="0" value={data.terraceAreaM2 || ''} onChange={e => set('terraceAreaM2', parseFloat(e.target.value) || '')} className="w-32" />
          </FieldGroup>
        )}
      </div>

      {/* Window directions */}
      <FieldGroup label="Langų kryptys">
        <div className="flex gap-2 flex-wrap">
          {DIRECTIONS.map(([k, v]) => (
            <button
              key={k} type="button"
              onClick={() => toggleDirection(k)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                (data.windowDirections || []).includes(k)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary/40'
              )}
            >{v}</button>
          ))}
        </div>
      </FieldGroup>

      {/* Notes */}
      <FieldGroup label="Viešas komentaras">
        <textarea
          className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          placeholder="Matomas klientams..."
          value={data.publicComment || ''}
          onChange={e => set('publicComment', e.target.value)}
        />
      </FieldGroup>
      <FieldGroup label="Vidinės pastabos">
        <textarea
          className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          placeholder="Tik vidiniam naudojimui..."
          value={data.internalNotes || ''}
          onChange={e => set('internalNotes', e.target.value)}
        />
      </FieldGroup>

      <div className="flex items-center gap-3 justify-end pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Atšaukti</Button>
        <Button type="submit" disabled={saving || !data.projectId || !data.type || !data.label || !data.areaM2 || !data.price}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saugoma...</> : 'Sukurti objektą'}
        </Button>
      </div>
    </form>
  );
}