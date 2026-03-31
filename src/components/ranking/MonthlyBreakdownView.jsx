import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
  'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'
];

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

function MonthCard({ monthData, now }) {
  const [expanded, setExpanded] = useState(false);
  const { month, ranking } = monthData;
  const isPast = new Date(monthData.year, month - 1, 1) < new Date(now.getFullYear(), now.getMonth(), 1);
  const isCurrent = month === now.getMonth() + 1 && monthData.year === now.getFullYear();
  const isFuture = !isPast && !isCurrent;

  const top3 = ranking.slice(0, 3);
  const hasData = ranking.some(r => r.uniqueAgreementUnits > 0 || r.meetingsCount > 0 || r.callsCount > 0);

  return (
    <Card className={`transition-all ${isCurrent ? 'border-primary shadow-md' : ''}`}>
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => !isFuture && setExpanded(e => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">
              {MONTH_NAMES[month - 1]}
            </CardTitle>
            {isCurrent && <Badge className="text-xs bg-primary">Einamasis</Badge>}
            {isFuture && <Badge variant="secondary" className="text-xs">Būsimas</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {hasData && !isFuture && (
              <div className="flex gap-1">
                {top3.filter(r => r.uniqueAgreementUnits > 0).map(r => (
                  <span key={r.agentId} className="text-xs text-muted-foreground">
                    {MEDAL[r.rankPosition] || ''} {r.agentName.split(' ')[0]}
                  </span>
                ))}
              </div>
            )}
            {!isFuture && (
              expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && !isFuture && (
        <CardContent className="pt-0 px-4 pb-4">
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-2">Šį mėnesį veiklos nebuvo</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-1 text-left font-medium text-muted-foreground">Vadybininkas</th>
                  <th className="py-1 text-center font-medium text-muted-foreground">Sutartys</th>
                  <th className="py-1 text-center font-medium text-muted-foreground">Apžiūros</th>
                  <th className="py-1 text-center font-medium text-muted-foreground">Skambučiai</th>
                </tr>
              </thead>
              <tbody>
                {ranking.filter(r => r.uniqueAgreementUnits > 0 || r.meetingsCount > 0 || r.callsCount > 0).map(r => (
                  <tr key={r.agentId} className="border-b last:border-0">
                    <td className="py-1.5 font-medium">
                      {MEDAL[r.rankPosition] || `#${r.rankPosition}`} {r.agentName}
                    </td>
                    <td className="py-1.5 text-center font-bold text-primary">{r.uniqueAgreementUnits}</td>
                    <td className="py-1.5 text-center text-muted-foreground">{r.meetingsCount}</td>
                    <td className="py-1.5 text-center text-muted-foreground">{r.callsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function MonthlyBreakdownView({ breakdown = [], year, isLoading }) {
  const now = new Date();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-16 bg-secondary animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (breakdown.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Duomenų nėra</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Spustelėkite mėnesį, kad matytumėte detalų reitingą. Kiekvienam mėnesiui skaičiuojami tik pirmą kartą tą mėnesį atsiradę sutartiniai vienetai.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {breakdown.map(m => <MonthCard key={m.month} monthData={{ ...m, year }} now={now} />)}
      </div>
    </div>
  );
}