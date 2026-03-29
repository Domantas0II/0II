import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, BarChart2, ChevronRight, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const TYPE_LABELS = {
  sales: 'Pardavimai',
  finance: 'Finansai',
  pipeline: 'Pipeline',
  agent_performance: 'Agentų veikla',
  custom: 'Kitas'
};
const TYPE_COLORS = {
  sales: 'bg-blue-100 text-blue-800',
  finance: 'bg-green-100 text-green-800',
  pipeline: 'bg-purple-100 text-purple-800',
  agent_performance: 'bg-orange-100 text-orange-800',
  custom: 'bg-gray-100 text-gray-700'
};

export default function ReportsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const role = normalizeRole(currentUser?.role);
  const canManage = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reportDefinitions'],
    queryFn: () => base44.entities.ReportDefinition.list('-created_date', 100)
  });

  const { data: executions = [] } = useQuery({
    queryKey: ['reportExecutions-recent'],
    queryFn: () => base44.entities.ReportExecution.list('-executedAt', 50)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReportDefinition.update(id, { isActive: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] }); toast.success('Ataskaita pašalinta'); }
  });

  const activeReports = reports.filter(r => r.isActive !== false);

  // Last execution per report
  const lastExec = {};
  executions.forEach(e => {
    if (!lastExec[e.reportDefinitionId]) lastExec[e.reportDefinitionId] = e;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Ataskaitos</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/scheduled-reports">
            <Button variant="outline" className="gap-2"><Calendar className="h-4 w-4" />Suplanuotos</Button>
          </Link>
          {canManage && (
            <Link to="/reports/new">
              <Button className="gap-2"><Plus className="h-4 w-4" />Nauja ataskaita</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(TYPE_LABELS).filter(([k]) => k !== 'custom').map(([type, label]) => {
          const count = activeReports.filter(r => r.type === type).length;
          return (
            <Card key={type}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reports list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : activeReports.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <BarChart2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">Nėra ataskaitų. Sukurkite pirmą!</p>
            {canManage && <Link to="/reports/new"><Button className="mt-4 gap-2"><Plus className="h-4 w-4" />Nauja ataskaita</Button></Link>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {activeReports.map(r => {
            const exec = lastExec[r.id];
            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge className={TYPE_COLORS[r.type]}>{TYPE_LABELS[r.type]}</Badge>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      {exec && (
                        <p className="text-xs text-muted-foreground">
                          Paskutinis paleidimas: {new Date(exec.executedAt).toLocaleDateString('lt-LT')} · {exec.rowCount || 0} eilutės
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/reports/${r.id}`)}>
                      Paleisti
                    </Button>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}