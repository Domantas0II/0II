import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, ChevronRight, Globe, Building2 } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const APPLIES_TO_LABELS = { agent: 'Agentas', partner: 'Partneris', agency: 'Agentūra' };

export default function CommissionRulesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [appliesToFilter, setAppliesToFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const role = normalizeRole(currentUser?.role);
  const canManage = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['commissionRules'],
    queryFn: () => base44.entities.CommissionRule.list('-created_date', 200)
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-map'],
    queryFn: () => base44.entities.Project.list('-created_date', 200)
  });
  const projectsMap = Object.fromEntries((projects || []).map(p => [p.id, p]));

  const toggleMutation = useMutation({
    mutationFn: (rule) => base44.functions.invoke('upsertCommissionRule', {
      id: rule.id,
      projectId: rule.projectId,
      appliesTo: rule.appliesTo,
      calculationType: rule.calculationType,
      value: rule.value,
      vatMode: rule.vatMode,
      isActive: !rule.isActive
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionRules'] });
      toast.success('Taisyklė atnaujinta');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const filtered = rules.filter(r => {
    if (appliesToFilter !== 'all' && r.appliesTo !== appliesToFilter) return false;
    if (activeFilter === 'active' && !r.isActive) return false;
    if (activeFilter === 'inactive' && r.isActive) return false;
    return true;
  });

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-muted-foreground">Prieiga uždrausta</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Komisinių taisyklės</h1>
          <p className="text-sm text-muted-foreground mt-1">Apibrėžia kaip skaičiuojami komisiniai pagal projektą ar globaliai</p>
        </div>
        <Button onClick={() => navigate('/commission-rules/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Nauja taisyklė
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={appliesToFilter} onValueChange={setAppliesToFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Visi tipai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="agent">Agentas</SelectItem>
            <SelectItem value="partner">Partneris</SelectItem>
            <SelectItem value="agency">Agentūra</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Visi statusai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="active">Aktyvios</SelectItem>
            <SelectItem value="inactive">Neaktyvios</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} taisyklės</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            <p>Taisyklių nerasta.</p>
            <Button className="mt-4" onClick={() => navigate('/commission-rules/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Sukurti pirmą taisyklę
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(rule => {
            const project = rule.projectId ? projectsMap[rule.projectId] : null;
            return (
              <Card key={rule.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {rule.projectId ? (
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {project ? project.projectName : 'Globali taisyklė'}
                        </span>
                        <Badge variant="outline">{APPLIES_TO_LABELS[rule.appliesTo] || rule.appliesTo}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rule.calculationType === 'percentage' ? `${rule.value}%` : `€${rule.value} fiksuota`}
                        {' · '}
                        {rule.vatMode === 'with_vat' ? 'Kaina su PVM' : 'Kaina be PVM'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => toggleMutation.mutate(rule)}
                      disabled={toggleMutation.isPending}
                    />
                    <Link to={`/commission-rules/${rule.id}`}>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
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