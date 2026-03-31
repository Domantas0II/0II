import React from 'react';
import { Badge } from '@/components/ui/badge';

const MEDAL_COLORS = {
  1: { bg: 'bg-yellow-50 border-yellow-200', label: '🥇' },
  2: { bg: 'bg-slate-50 border-slate-200', label: '🥈' },
  3: { bg: 'bg-orange-50 border-orange-200', label: '🥉' },
};

function RankLabel({ row }) {
  const medal = MEDAL_COLORS[row.rankPosition];
  const label = medal ? medal.label : `#${row.rankPosition}`;
  return (
    <span className="flex items-center gap-1">
      <span className="text-base">{label}</span>
      {row.isTie && (
        <Badge variant="outline" className="text-xs px-1 py-0 h-4 leading-none">lygios</Badge>
      )}
    </span>
  );
}

function RankRow({ row, isMobile }) {
  const medal = MEDAL_COLORS[row.rankPosition];

  if (isMobile) {
    return (
      <div className={`rounded-xl border p-4 space-y-2 ${medal ? medal.bg : 'bg-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RankLabel row={row} />
            <span className="font-semibold text-base">{row.agentName}</span>
          </div>
          <Badge variant="outline" className="text-xs font-bold">
            {row.uniqueAgreementUnits} obj.
          </Badge>
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground pl-8">
          <span>🤝 {row.meetingsCount} apžiūros</span>
          <span>📞 {row.callsCount} skambučiai</span>
        </div>
      </div>
    );
  }

  return (
    <tr className={`border-b last:border-0 ${medal ? `${medal.bg} border-l-4` : ''}`}>
      <td className="py-3 px-4 text-center">
        <RankLabel row={row} />
      </td>
      <td className="py-3 px-4 font-medium">{row.agentName}</td>
      <td className="py-3 px-4 text-center">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
          row.uniqueAgreementUnits > 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
        }`}>
          {row.uniqueAgreementUnits}
        </span>
      </td>
      <td className="py-3 px-4 text-center text-sm text-muted-foreground">{row.meetingsCount}</td>
      <td className="py-3 px-4 text-center text-sm text-muted-foreground">{row.callsCount}</td>
    </tr>
  );
}

export default function ManagerRankingTable({ ranking = [], isMobile = false, emptyLabel = 'Duomenų nėra' }) {
  if (ranking.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        <p className="text-2xl mb-2">📋</p>
        <p>{emptyLabel}</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-2">
        {ranking.map(row => <RankRow key={row.agentId} row={row} isMobile />)}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-secondary/30">
            <th className="py-2 px-4 text-center text-xs font-semibold text-muted-foreground w-16">Vieta</th>
            <th className="py-2 px-4 text-left text-xs font-semibold text-muted-foreground">Vadybininkas</th>
            <th className="py-2 px-4 text-center text-xs font-semibold text-muted-foreground">Sutartiniai vienetai</th>
            <th className="py-2 px-4 text-center text-xs font-semibold text-muted-foreground">Konsult. / apžiūros</th>
            <th className="py-2 px-4 text-center text-xs font-semibold text-muted-foreground">Skambučiai</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map(row => <RankRow key={row.agentId} row={row} isMobile={false} />)}
        </tbody>
      </table>
    </div>
  );
}