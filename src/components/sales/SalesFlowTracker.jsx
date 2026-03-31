import { CheckCircle2, Circle, Lock, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

export const FLOW_STEPS = [
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
 *   currentStep: one of FLOW_STEPS keys
 *   completedSteps: array of step keys that are done
 *   lockedSteps: array of step keys that are locked
 *   compact: boolean — render smaller version
 *   timestamps: object { stepKey: ISO string } — when step was completed
 *   owner: string — soldByUserId / owner name to display
 */
export default function SalesFlowTracker({
  currentStep,
  completedSteps = [],
  lockedSteps = [],
  compact = false,
  timestamps = {},
  owner = null,
}) {
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
                <div className={`h-px w-3 ${state === 'completed' ? 'bg-green-400' : 'bg-border'}`} />
              )}
              <div className={`
                flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border
                ${state === 'completed' ? 'bg-green-50 border-green-300 text-green-700' : ''}
                ${state === 'current' ? 'bg-primary text-primary-foreground border-primary' : ''}
                ${state === 'locked' ? 'bg-muted/30 border-border text-muted-foreground/40' : ''}
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
    <div className="space-y-2">
      {owner && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{owner}</span>
        </div>
      )}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {FLOW_STEPS.map((step, idx) => {
          const state = getStepState(step.key);
          const ts = timestamps[step.key];
          return (
            <div key={step.key} className="flex items-start flex-shrink-0">
              {idx > 0 && (
                <div className={`h-px w-5 mt-4 ${state === 'completed' ? 'bg-green-400' : 'bg-border'}`} />
              )}
              <div className={`
                flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs font-medium border transition-all min-w-[72px] text-center
                ${state === 'completed' ? 'bg-green-50 border-green-300 text-green-700' : ''}
                ${state === 'current' ? 'bg-primary text-primary-foreground border-primary shadow-md' : ''}
                ${state === 'locked' ? 'bg-muted/20 border-dashed border-border text-muted-foreground/40' : ''}
                ${state === 'pending' ? 'bg-card border-border text-muted-foreground' : ''}
              `}>
                <div className="flex items-center gap-1">
                  {state === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                  {state === 'locked' && <Lock className="h-3 w-3" />}
                  {state === 'current' && <Circle className="h-3 w-3 fill-current" />}
                  {state === 'pending' && <Circle className="h-3 w-3" />}
                </div>
                <span className="leading-tight">{step.label}</span>
                {ts && state === 'completed' && (
                  <div className="flex items-center gap-0.5 text-[9px] opacity-70 mt-0.5">
                    <Clock className="h-2 w-2" />
                    <span>{format(new Date(ts), 'MM-dd HH:mm')}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Helper: derive flow state from entity data
 *
 * Returns: { completedSteps, currentStep, lockedSteps, timestamps }
 */
export function deriveSalesFlowState({ inquiry, interest, reservation, agreement, deal, commission, payout }) {
  const completed = [];
  const timestamps = {};
  let current = 'inquiry';

  if (inquiry) {
    completed.push('inquiry');
    current = 'interest';
    if (inquiry.created_date) timestamps.inquiry = inquiry.created_date;
  }
  if (interest) {
    completed.push('interest');
    current = 'reservation';
    if (interest.created_date) timestamps.interest = interest.created_date;
  }
  if (reservation) {
    completed.push('reservation');
    current = 'agreement';
    if (reservation.reservedAt) timestamps.reservation = reservation.reservedAt;
  }
  if (agreement) {
    if (agreement.status === 'signed') {
      completed.push('agreement');
      current = 'deal';
      if (agreement.signedAt) timestamps.agreement = agreement.signedAt;
    } else {
      // draft — still current
      current = 'agreement';
    }
  }
  if (deal) {
    completed.push('deal');
    current = 'commission';
    if (deal.soldAt) timestamps.deal = deal.soldAt;
  }
  if (commission) {
    completed.push('commission');
    current = 'payout';
    if (commission.calculatedAt) timestamps.commission = commission.calculatedAt;
  }
  if (payout) {
    completed.push('payout');
    current = 'payout';
    if (payout.paidAt) timestamps.payout = payout.paidAt;
  }

  const locked = FLOW_STEPS
    .map(s => s.key)
    .filter(k => !completed.includes(k) && k !== current);

  return { completedSteps: completed, currentStep: current, lockedSteps: locked, timestamps };
}