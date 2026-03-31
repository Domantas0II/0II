import React, { useState, useEffect } from 'react';
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Info, CalendarDays } from 'lucide-react';
import ManagerRankingTable from './ManagerRankingTable';
import MonthlyBreakdownView from './MonthlyBreakdownView';

const MONTH_NAMES = [
  'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
  'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis'
];

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}


export default function ManagerRankingBlock({ projectId }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isMobile = useIsMobile();

  const [tab, setTab] = useState('year'); // 'year' | 'month' | 'breakdown'
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Year ranking
  const { data: yearData, isLoading: yearLoading } = useQuery({
    queryKey: ['managerRanking', 'year', selectedYear, projectId],
    queryFn: () => base44.functions.invoke('getManagerRanking', {
      mode: 'year', year: selectedYear, projectId: projectId || null
    }).then(r => r.data),
    staleTime: 5 * 60 * 1000
  });

  // Month ranking
  const { data: monthData, isLoading: monthLoading } = useQuery({
    queryKey: ['managerRanking', 'month', selectedYear, selectedMonth, projectId],
    queryFn: () => base44.functions.invoke('getManagerRanking', {
      mode: 'month', year: selectedYear, month: selectedMonth, projectId: projectId || null
    }).then(r => r.data),
    enabled: tab === 'month',
    staleTime: 5 * 60 * 1000
  });

  // Monthly breakdown
  const { data: breakdownData, isLoading: breakdownLoading } = useQuery({
    queryKey: ['managerRanking', 'monthly_breakdown', selectedYear, projectId],
    queryFn: () => base44.functions.invoke('getManagerRanking', {
      mode: 'monthly_breakdown', year: selectedYear, projectId: projectId || null
    }).then(r => r.data),
    enabled: tab === 'breakdown',
    staleTime: 5 * 60 * 1000
  });

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].filter(Boolean);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Vadybininkų reitingas</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-2 bg-secondary/50 rounded-lg p-1 w-fit">
          {[
            { key: 'year', label: `Metai (${selectedYear})` },
            { key: 'month', label: 'Mėnuo' },
            { key: 'breakdown', label: 'Mėnesių išklotinė' }
          ].map(t => (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? 'default' : 'ghost'}
              className="h-7 text-xs px-3"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* Month selector */}
        {tab === 'month' && (
          <div className="flex items-center gap-2 mt-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{selectedYear}</span>
          </div>
        )}

        {/* Info note */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-2">
          <Info className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            Tas pats objektas per reitinginį laikotarpį skaičiuojamas tik vieną kartą pagal pirmą rezervacinę arba preliminarią sutartį.
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {tab === 'year' && (
          <>
            {yearLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-secondary animate-pulse rounded" />)}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {selectedYear} m. sausis – gruodis
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {yearData?.ranking?.length || 0} vadybininkų
                  </span>
                </div>
                <ManagerRankingTable
                  ranking={yearData?.ranking || []}
                  isMobile={isMobile}
                  emptyLabel="Šiais metais duomenų nėra"
                />
              </>
            )}
          </>
        )}

        {tab === 'month' && (
          <>
            {monthLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-secondary animate-pulse rounded" />)}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {monthData?.ranking?.length || 0} vadybininkų
                  </span>
                </div>
                <ManagerRankingTable
                  ranking={monthData?.ranking || []}
                  isMobile={isMobile}
                  emptyLabel="Šį mėnesį duomenų nėra"
                />
              </>
            )}
          </>
        )}

        {tab === 'breakdown' && (
          <MonthlyBreakdownView
            breakdown={breakdownData?.breakdown || []}
            year={selectedYear}
            isLoading={breakdownLoading}
          />
        )}
      </CardContent>
    </Card>
  );
}