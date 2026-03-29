import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import FieldGroup from '@/components/projects/FieldGroup';
import { ADVANCE_TYPE_LABELS, COMMISSION_VAT_LABELS } from '@/lib/projectConstants';

export default function StepFinancial({ data, onChange }) {
  const set = (key, val) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-lg bg-muted/40 border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Vystytojo įmonės duomenys</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label="Įmonės pavadinimas" required>
            <Input placeholder="UAB ..." value={data.developerCompanyName || ''} onChange={e => set('developerCompanyName', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Įmonės kodas" required>
            <Input placeholder="300000000" value={data.developerCompanyCode || ''} onChange={e => set('developerCompanyCode', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="PVM kodas" required>
            <Input placeholder="LT000000000" value={data.developerVatCode || ''} onChange={e => set('developerVatCode', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="El. paštas" required>
            <Input type="email" placeholder="info@imone.lt" value={data.developerEmail || ''} onChange={e => set('developerEmail', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Telefonas" required>
            <Input placeholder="+370 600 00000" value={data.developerPhone || ''} onChange={e => set('developerPhone', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Banko sąskaita" required>
            <Input placeholder="LT00 0000 0000 0000 0000" value={data.developerBankAccount || ''} onChange={e => set('developerBankAccount', e.target.value)} />
          </FieldGroup>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-muted/40 border space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avansas</p>
        <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
          <p className="text-sm font-medium">Reikalingas avansas</p>
          <Switch checked={!!data.advanceRequired} onCheckedChange={v => set('advanceRequired', v)} />
        </div>
        {data.advanceRequired && (
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Avanso tipas">
              <Select value={data.advanceType || ''} onValueChange={v => set('advanceType', v)}>
                <SelectTrigger><SelectValue placeholder="Tipas..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ADVANCE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label={data.advanceType === 'percent' ? 'Procentai (%)' : 'Suma (€)'}>
              <Input type="number" min={0} placeholder="0" value={data.advanceValue || ''} onChange={e => set('advanceValue', parseFloat(e.target.value) || '')} />
            </FieldGroup>
          </div>
        )}
      </div>

      <div className="p-3 rounded-lg bg-muted/40 border space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Komisinių skaičiavimas</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Bendras komisinis % nuo pardavimo">
            <Input type="number" min={0} max={100} step={0.1} placeholder="pvz. 3.0" value={data.commissionCalculationPercent || ''} onChange={e => set('commissionCalculationPercent', parseFloat(e.target.value) || '')} />
          </FieldGroup>
          <FieldGroup label="Split bazė">
            <Select value={data.commissionSplitBase || 'without_vat'} onValueChange={v => set('commissionSplitBase', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="without_vat">Be PVM</SelectItem>
                <SelectItem value="with_vat">Su PVM</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Įmonės dalis (%)">
            <Input type="number" min={0} max={100} placeholder="70" value={data.companyCommissionSharePercent ?? 70} onChange={e => {
              const company = parseFloat(e.target.value) || 0;
              set('companyCommissionSharePercent', company);
              set('managerCommissionSharePercent', Math.round((100 - company) * 100) / 100);
            }} />
          </FieldGroup>
          <FieldGroup label="Vadybininko dalis (%)">
            <Input type="number" min={0} max={100} placeholder="30" value={data.managerCommissionSharePercent ?? 30} onChange={e => {
              const manager = parseFloat(e.target.value) || 0;
              set('managerCommissionSharePercent', manager);
              set('companyCommissionSharePercent', Math.round((100 - manager) * 100) / 100);
            }} />
          </FieldGroup>
        </div>
        {/* Validation hint */}
        {(data.companyCommissionSharePercent != null || data.managerCommissionSharePercent != null) && (
          (() => {
            const sum = (data.companyCommissionSharePercent ?? 70) + (data.managerCommissionSharePercent ?? 30);
            return sum !== 100 ? (
              <p className="text-xs text-destructive">Įmonės + vadybininko dalys turi sudaryti 100% (dabar: {sum}%)</p>
            ) : (
              <p className="text-xs text-green-600">✓ Dalys sudaro 100%</p>
            );
          })()
        )}
        {data.commissionCalculationPercent > 0 && (
          <div className="bg-background border rounded p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Peržiūra (nuo €100,000 pardavimo):</p>
            <p>Bendras komisinis: <strong>€{(100000 * (data.commissionCalculationPercent || 0) / 100).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</strong></p>
            <p>Įmonei: <strong>€{(100000 * (data.commissionCalculationPercent || 0) / 100 * (data.companyCommissionSharePercent ?? 70) / 100).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</strong></p>
            <p>Vadybininkui: <strong>€{(100000 * (data.commissionCalculationPercent || 0) / 100 * (data.managerCommissionSharePercent ?? 30) / 100).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}