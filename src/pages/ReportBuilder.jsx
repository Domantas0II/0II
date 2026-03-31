import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYPE_OPTIONS = [
  { value: 'sales',             label: 'Pardavimų ataskaita',   desc: 'Sandoriai, sumos, konversija' },
  { value: 'finance',           label: 'Finansų ataskaita',     desc: 'Komisiniai, įmonės/vadybininko dalys' },
  { value: 'pipeline',          label: 'Pipeline ataskaita',    desc: 'Piltuvo etapai, konversija' },
  { value: 'agent_performance', label: 'Agentų veikla',         desc: 'Pardavimai ir pajamos pagal agentą' }
];

function FieldGroup({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export default function ReportBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-report'],
    queryFn: () => base44.entities.Project.list('-created_date', 200)
  });

  const [form, setForm] = useState({
    name: '',
    type: 'sales',
    dateFrom: '',
    dateTo: '',
    selectedProjectIds: [],
    groupBy: ''
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const toggleProject = (id) => {
    set('selectedProjectIds', form.selectedProjectIds.includes(id)
      ? form.selectedProjectIds.filter(p => p !== id)
      : [...form.selectedProjectIds, id]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const configJson = JSON.stringify({
        projectIds: form.selectedProjectIds,
        dateFrom: form.dateFrom || null,
        dateTo: form.dateTo || null,
        groupBy: form.groupBy || null
      });
      return base44.entities.ReportDefinition.create({
        name: form.name,
        type: form.type,
        configJson,
        isActive: true,
        createdByUserId: user.id,
        createdAt: new Date().toISOString()
      });
    },
    onSuccess: (def) => {
      queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] });
      toast.success('Ataskaita išsaugota');
      navigate(`/reports/${def.id}`);
    },
    onError: (e) => toast.error(e?.message || 'Klaida')
  });

  const selectedType = TYPE_OPTIONS.find(t => t.value === form.type);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Nauja ataskaita</h1>
      </div>

      {/* Report name */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Ataskaitos informacija</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup label="Pavadinimas">
            <Input placeholder="pvz. Q1 2026 Pardavimai" value={form.name} onChange={e => set('name', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Ataskaitos tipas">
            <Select value={form.type} onValueChange={v => set('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-muted/40 rounded text-xs text-muted-foreground">
                <Info className="h-3 w-3 shrink-0" />{selectedType.desc}
              </div>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Date range */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Data</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <FieldGroup label="Nuo">
            <Input type="date" value={form.dateFrom} onChange={e => set('dateFrom', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Iki">
            <Input type="date" value={form.dateTo} onChange={e => set('dateTo', e.target.value)} />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Project filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Projektai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">Nepasirinkus — taikoma visiems prieinamiems projektams</p>
          <div className="flex flex-wrap gap-2">
            {projects.map(p => {
              const selected = form.selectedProjectIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProject(p.id)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  {p.projectName}
                </button>
              );
            })}
          </div>
          {form.selectedProjectIds.length > 0 && (
            <p className="text-xs text-muted-foreground">Pasirinkta: {form.selectedProjectIds.length} projektai</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!form.name || saveMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saugoma...' : 'Išsaugoti ir vykdyti'}
        </Button>
        <Link to="/reports"><Button variant="outline">Atšaukti</Button></Link>
      </div>
    </div>
  );
}