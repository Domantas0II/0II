import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { WIZARD_STEPS } from '@/lib/projectConstants';

export default function WizardStepNav({ currentStep, completedSteps = [] }) {
  const currentIdx = WIZARD_STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {WIZARD_STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPast = idx < currentIdx;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                isCurrent && 'bg-primary border-primary text-primary-foreground',
                isCompleted && !isCurrent && 'bg-green-500 border-green-500 text-white',
                !isCurrent && !isCompleted && isPast && 'bg-muted border-muted-foreground/30 text-muted-foreground',
                !isCurrent && !isCompleted && !isPast && 'bg-background border-border text-muted-foreground',
              )}>
                {isCompleted && !isCurrent ? <Check className="h-3.5 w-3.5" /> : step.shortLabel}
              </div>
              <span className={cn(
                'text-[10px] mt-1 font-medium hidden sm:block',
                isCurrent ? 'text-primary' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 min-w-[16px] mx-1 transition-all',
                idx < currentIdx ? 'bg-green-400' : 'bg-border'
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}