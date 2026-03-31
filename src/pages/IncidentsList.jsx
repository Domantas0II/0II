import React, { useState } from 'react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, ChevronRight } from 'lucide-react';

const SEV_COLORS = { critical: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-gray-100 text-gray-700' };
const STATUS_COLORS = { open: 'bg-red-100 text-red-800', investigating: 'bg-blue-100 text-blue-800', resolved: 'bg-green-100 text-green-800' };
const STATUS_LABELS = { open: 'Atidarytas', investigating: 'Tiriamas', resolved: 'Išspręstas' };

export default function IncidentsList() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [sevFilter, setSevFilter] = useState('all');

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.SystemIncident.list('-created_date', 200),
    refetchInterval: 30000
  });

  const filtered = incidents.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (sevFilter !== 'all' && i.severity !== sevFilter) return false;
    return true;
  });

  const openCount = incidents.filter(i => i.status === 'open').length;
  const critCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bug className="h-6 w-6" />Incidentai</h1>
        <div className="flex gap-2 text-sm">
          {critCount > 0 && <Badge className="bg-red-100 text-red-800">{critCount} kritinių</Badge>}
          <Badge variant="outline">{openCount} atvirų</Badge>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="open">Atidarytas</SelectItem>
            <SelectItem value="investigating">Tiriamas</SelectItem>
            <SelectItem value="resolved">Išspręstas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visos sunkumo</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} incidentai</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          {statusFilter === 'open' ? 'Nėra atvirų incidentų ✓' : 'Incidentų nerasta'}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(inc => (
            <Link key={inc.id} to={`/incidents/${inc.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={SEV_COLORS[inc.severity]}>{inc.severity}</Badge>
                      <Badge className={STATUS_COLORS[inc.status]}>{STATUS_LABELS[inc.status]}</Badge>
                      <span className="font-medium text-sm">{inc.incidentType.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{inc.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(inc.createdAt).toLocaleString('lt-LT')}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}