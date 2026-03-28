import React from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import FieldGroup from '@/components/projects/FieldGroup';

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

export default function StepProcess({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-3">
      <ToggleRow
        label="Įeinančių užklausų valdymas"
        hint="Leisti valdyti inbound užklausas šiame projekte"
        checked={data.inboundEnabled}
        onChange={v => set('inboundEnabled', v)}
      />
      <ToggleRow
        label="Užklausų baseinas"
        hint="Nepaskirtos užklausos patenka į bendrą baseiną"
        checked={data.inquiryPoolEnabled}
        onChange={v => set('inquiryPoolEnabled', v)}
      />
      <ToggleRow
        label="Konsultacija be objekto"
        hint="Leisti pradėti konsultaciją nepriskiriant konkretaus objekto"
        checked={data.allowConsultationWithoutUnit}
        onChange={v => set('allowConsultationWithoutUnit', v)}
      />
      <ToggleRow
        label="Rezervacija be apsilankymo"
        hint="Leisti rezervuoti objektą be ankstesnio apsilankymo"
        checked={data.allowReservationWithoutVisit}
        onChange={v => set('allowReservationWithoutVisit', v)}
      />
      <FieldGroup label="Rezervacijos galiojimas (dienų)" hint="Po kiek dienų rezervacija automatiškai baigiasi">
        <Input
          type="number"
          min={1}
          max={365}
          placeholder="pvz. 14"
          value={data.reservationExpiryDays || ''}
          onChange={e => set('reservationExpiryDays', parseInt(e.target.value) || '')}
          className="w-40"
        />
      </FieldGroup>
    </div>
  );
}