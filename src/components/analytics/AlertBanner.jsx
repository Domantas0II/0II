import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export default function AlertBanner({ alerts, severity = 'warning' }) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const icon = severity === 'critical' ? AlertTriangle : AlertCircle;
  const Icon = icon;
  const bgClass = severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50';
  const textClass = severity === 'critical' ? 'text-red-800' : 'text-amber-800';
  const iconClass = severity === 'critical' ? 'text-red-600' : 'text-amber-600';

  return (
    <Alert className={`${bgClass} ${textClass}`}>
      <Icon className={`h-4 w-4 ${iconClass}`} />
      <AlertDescription className={textClass}>
        <div className="space-y-1">
          {alerts.map((alert, idx) => (
            <p key={idx} className="text-sm">{alert}</p>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}