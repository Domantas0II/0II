import React from 'react';
import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PROJECT_TYPE_LABELS, PROJECT_STAGE_LABELS,
  UNIT_TYPE_LABELS, STRUCTURE_MODEL_LABELS,
  INSTALLATION_STATUS_LABELS, ENERGY_CLASS_LABELS,
  COMPONENT_LABELS
} from '@/lib/projectConstants';
import { calcCompleteness } from '@/lib/projectCompleteness';

function ReviewBlock({ title, status, items }) {
  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-2',
      status === 'ok' ? 'border-green-200 bg-green-50/50' :
      status === 'partial' ? 'border-amber-200 bg-amber-50/50' :
      'border-destructive/20 bg-destructive/5'
    )}>
      <div className="flex items-center gap-2">
        {status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        {status === 'partial' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
        {status === 'missing' && <XCircle className="h-4 w-4 text-destructive" />}
        <p className={cn(
          'text-sm font-semibold',
          status === 'ok' ? 'text-green-800' :
          status === 'partial' ? 'text-amber-800' :
          'text-destructive'
        )}>{title}</p>
      </div>
      {items && (
        <div className="space-y-1 pl-6">
          {items.map((item, i) => (
            <p key={i} className="text-xs text-muted-foreground">{item}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StepReview({ base, inventory, components, technical, financial, process }) {
  const { percent, blockers, criticalBlockers } = calcCompleteness(base, inventory, components, technical, financial, process);

  const baseStatus = !blockers.includes('base') ? 'ok' : 'missing';
  const invStatus = !blockers.includes('inventory') ? 'ok' : 'missing';
  const compStatus = components ? 'ok' : 'missing';
  const techStatus = (technical?.installationStatus && technical?.energyClass) ? 'ok' : 'partial';
  const finStatus = !blockers.includes('financial') ? 'ok' : 'missing';
  const procStatus = process ? 'ok' : 'partial';

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="p-4 rounded-xl bg-card border space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Setup užbaigtumas</p>
          <span className={cn(
            'text-lg font-bold',
            percent >= 80 ? 'text-green-600' : percent >= 50 ? 'text-amber-600' : 'text-destructive'
          )}>{percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              percent >= 80 ? 'bg-green-500' : percent >= 50 ? 'bg-amber-500' : 'bg-destructive'
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        {criticalBlockers.length > 0 && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Negalima perkelti į &quot;Paruoštas viduje&quot; — trūksta kritinių blokų
          </p>
        )}
      </div>

      {/* Blocks */}
      <div className="space-y-2">
        <ReviewBlock
          title="1. Projekto bazė"
          status={baseStatus}
          items={base ? [
            base.projectName && `Pavadinimas: ${base.projectName}`,
            base.projectCode && `Kodas: ${base.projectCode}`,
            base.projectType && `Tipas: ${PROJECT_TYPE_LABELS[base.projectType]}`,
            base.projectStage && `Stadija: ${PROJECT_STAGE_LABELS[base.projectStage]}`,
            (base.city && base.district) && `Vieta: ${base.city}, ${base.district}`,
          ].filter(Boolean) : ['Nepradėta']}
        />
        <ReviewBlock
          title="2. Inventory modelis"
          status={invStatus}
          items={inventory ? [
            inventory.unitTypesEnabled?.length > 0 && `Tipai: ${inventory.unitTypesEnabled.map(t => UNIT_TYPE_LABELS[t]).join(', ')}`,
            inventory.structureModel && `Struktūra: ${STRUCTURE_MODEL_LABELS[inventory.structureModel]}`,
          ].filter(Boolean) : ['Nepradėta']}
        />
        <ReviewBlock
          title="3. Dedamosios"
          status={compStatus}
          items={components ? [
            components.componentsEnabled?.length > 0
              ? `Aktyvios: ${components.componentsEnabled.map(c => COMPONENT_LABELS[c]).join(', ')}`
              : 'Nė viena dedamoji neįjungta',
          ] : ['Nepradėta']}
        />
        <ReviewBlock
          title="4. Techniniai default'ai"
          status={techStatus}
          items={technical ? [
            technical.installationStatus && `Įrengimas: ${INSTALLATION_STATUS_LABELS[technical.installationStatus]}`,
            technical.energyClass && `Energetinė klasė: ${technical.energyClass}`,
            technical.constructionYear && `Statybos metai: ${technical.constructionYear}`,
          ].filter(Boolean) : ['Nepradėta']}
        />
        <ReviewBlock
          title="5. Finansai"
          status={finStatus}
          items={financial ? [
            financial.developerCompanyName && `Įmonė: ${financial.developerCompanyName}`,
            financial.developerCompanyCode && `Kodas: ${financial.developerCompanyCode}`,
            financial.advanceRequired && `Avansas: ${financial.advanceValue}${financial.advanceType === 'percent' ? '%' : '€'}`,
            financial.commissionPercentDefault && `Komisinis: ${financial.commissionPercentDefault}%`,
          ].filter(Boolean) : ['Nepradėta']}
        />
        <ReviewBlock
          title="6. Proceso konfigūracija"
          status={procStatus}
          items={process ? [
            process.inboundEnabled && 'Inbound užklausos: įjungta',
            process.inquiryPoolEnabled && 'Užklausų baseinas: įjungta',
            process.reservationExpiryDays && `Rezervacijos galiojimas: ${process.reservationExpiryDays} d.`,
          ].filter(Boolean) : ['Nepradėta']}
        />
      </div>
    </div>
  );
}