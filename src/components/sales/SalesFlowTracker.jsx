import { CheckCircle2, Circle, Lock } from 'lucide-react';

const FLOW_STEPS = [
  { key: 'inquiry',     label: 'Užklausa' },
  { key: 'interest',    label: 'Susidomėjimas' },
  { key: 'reservation', label: 'Rezervacija' },
  { key: 'agreement',   label: 'Sutartis' },
  { key: 'deal',        label: 'Pardavimas' },
  { key: 'commission',  label: 'Komisinis' },
  { key: 'payout',      label: 'Išmoka' },
];

/**
 * SalesFlowTracker
 * 
 * Props:
 *   currentStep: one of FLOW_STEPS keys — the ACTIVE current step
 *   completedSteps: array of step keys that are completed
 *   lockedSteps: array of step keys that are locked (not yet reachable)
 *   compact: boolean — render smaller version
 */
export default function SalesFlowTracker({ currentStep, completedSteps = [], lockedSteps = [], compact = false }) {
  const getStepState = (key) => {
    if (completedSteps.includes(key)) return 'completed';
    if (key === currentStep) return 'current';
    if (lockedSteps.includes(key)) return 'locked';
    return 'pending';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {FLOW_STEPS.map((step, idx) => {
          const state = getStepState(step.key);
          return (
            <div key={step.key} className="flex items-center gap-1">
              {idx > 0 && (
                <div className={`h-px w-4 ${state === 'completed' ? 'bg-green-400' : 'bg-border'}`} />
              )}
              <div className={`
                flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border
                ${state === 'completed' ? 'bg-green-50 border-green-300 text-green-700' : ''}
                ${state === 'current' ? 'bg-primary text-primary-foreground border-primary' : ''}
                ${state === 'locked' ? 'bg-muted/50 border-border text-muted-foreground/50' : ''}
                ${state === 'pending' ? 'bg-muted/30 border-border text-muted-foreground' : ''}
              `}>
                {state === 'completed' && <CheckCircle2 className="h-2.5 w-2.5" />}
                {state === 'locked' && <Lock className="h-2.5 w-2.5" />}
                {state === 'current' && <Circle className="h-2.5 w-2.5 fill-current" />}
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {FLOW_STEPS.map((step, idx) => {
        const state = getStepState(step.key);
        return (
          <div key={step.key} className="flex items-center flex-shrink-0">
            {idx > 0 && (
              <div className={`h-px w-6 ${state === 'completed' ? 'bg-green-400' : 'bg-border'}`} />
            )}
            <div className={`
              flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all
              ${state === 'completed' ? 'bg-green-50 border-green-300 text-green-700' : ''}
              ${state === 'current' ? 'bg-primary text-primary-foreground border-primary shadow-md' : ''}
              ${state === 'locked' ? 'bg-muted/30 border-dashed border-border text-muted-foreground/40' : ''}
              ${state === 'pending' ? 'bg-card border-border text-muted-foreground' : ''}
            `}>
              <div className="flex items-center gap-1">
                {state === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                {state === 'locked' && <Lock className="h-3 w-3" />}
                {state === 'current' && <Circle className="h-3 w-3 fill-current" />}
                {state === 'pending' && <Circle className="h-3 w-3" />}
                <span>{step.label}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Helper: derive flow state from entity data
 */
export function deriveSalesFlowState({ inquiry, interest, reservation, agreement, deal, commission, payout }) {
  const completed = [];
  let current = 'inquiry';
  const locked = [];

  if (inquiry) { completed.push('inquiry'); current = 'interest'; }
  if (interest) { completed.push('interest'); current = 'reservation'; }
  if (reservation) { completed.push('reservation'); current = 'agreement'; }
  if (agreement?.status === 'signed' || agreement?.status === 'draft') {
    if (agreement.status === 'signed') {
      completed.push('agreement');
      current = 'deal';
    } else {
      current = 'agreement';
    }
  }
  if (deal) { completed.push('deal'); current = 'commission'; }
  if (commission) { completed.push('commission'); current = 'payout'; }
  if (payout) { completed.push('payout'); current = 'payout'; }

  // Lock steps that haven't been reached
  FLOW_STEPS.forEach(step => {
    if (!completed.includes(step.key) && step.key !== current) {
      locked.push(step.key);
    }
  });

  return { completedSteps: completed, currentStep: current, lockedSteps: locked };
}