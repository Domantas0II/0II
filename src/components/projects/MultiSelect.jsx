import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export default function MultiSelect({ options, value = [], onChange, label }) {
  const toggle = (key) => {
    if (value.includes(key)) {
      onChange(value.filter(v => v !== key));
    } else {
      onChange([...value, key]);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-medium">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-foreground hover:border-primary/40'
              )}
            >
              {active && <Check className="inline h-3 w-3 mr-1" />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}