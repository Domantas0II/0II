import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const EMPTY_FORM = {
  projectId: '',
  appliesTo: 'agent',
  calculationType: 'percentage',
  value: '',
  vatMode: 'without_vat',
  isActive: true
};

function FieldLabel({ children, required }) {
  return (
    <label className="text-sm font-medium mb-1 block">
      {children}{required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

export default function CommissionRuleForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const role = normalizeRole(currentUser?.role);
  const canManage = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-select'],
    queryFn: () => base44.entities.Project.list('-created_date', 200)
  });

  // Load existing rule for edit
  const { data: existingRules = [] } = useQuery({
    queryKey: ['commissionRule', id],
    queryFn: () => base44.entities.CommissionRule.filter({ id }),
    enabled: isEdit
  });

  useEffect(() => {
    if (isEdit && existingRules.length > 0) {
      const r = existingRules[0];
      setForm({
        projectId: r.projectId || '',
        appliesTo: r.appliesTo,
        calculationType: r.calculationType,
        value: r.value,
        vatMode: r.vatMode,
        isActive: r.isActive
      });
    }
  }, [existingRules, isEdit]);

  const validate = () => {
    const e = {};
    if (!form.appliesTo) e.appliesTo = 'Privalomas laukas';
    if (!form.calculationType) e.calculationType = 'Privalomas laukas';
    if (!form.vatMode) e.vatMode = 'Privalomas laukas';
    const val = parseFloat(form.value);
    if (!form.value || isNaN(val) || val <= 0) e.value = 'Turi būti > 0';
    if (form.calculationType === 'percentage' && val > 100) e.value = 'Procentas negali viršyti 100';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: () => base44.functions.invoke('upsertCommissionRule', {
      ...(isEdit ? { id } : {}),
      projectId: form.projectId || null,
      appliesTo: form.appliesTo,
      calculationType: form.calculationType,
      value: parseFloat(form.value),
      vatMode: form.vatMode,
      isActive: form.isActive
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionRules'] });
      toast.success(isEdit ? 'Taisyklė atnaujinta' : 'Taisyklė sukurta');
      navigate('/commission-rules');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) saveMutation.mutate();
  };

  if (!canManage) {
    return <div className="p-8 text-center text-muted-foreground">Prieiga uždrausta</div>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link to="/commission-rules">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">{isEdit ? 'Redaguoti taisyklę' : 'Nauja komisinių taisyklė'}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Taisyklės duomenys</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Project (optional) */}
            <div>
              <FieldLabel>Projektas (tuščias = globali taisyklė)</FieldLabel>
              <Select value={form.projectId || '__global__'} onValueChange={(v) => setForm(f => ({ ...f, projectId: v === '__global__' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pasirinkti projektą..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">🌐 Globali (visi projektai)</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.projectId ? (
                <p className="text-xs text-muted-foreground mt-1">Taisyklė taikoma tik šiam projektui</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Globali taisyklė — naudojama kai nėra projekto taisyklės</p>
              )}
            </div>

            {/* Applies to */}
            <div>
              <FieldLabel required>Taikoma kam</FieldLabel>
              <Select value={form.appliesTo} onValueChange={(v) => setForm(f => ({ ...f, appliesTo: v }))}>
                <SelectTrigger className={errors.appliesTo ? 'border-destructive' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agentas</SelectItem>
                  <SelectItem value="partner">Partneris</SelectItem>
                  <SelectItem value="agency">Agentūra</SelectItem>
                </SelectContent>
              </Select>
              {errors.appliesTo && <p className="text-xs text-destructive mt-1">{errors.appliesTo}</p>}
            </div>

            {/* Calculation type */}
            <div>
              <FieldLabel required>Skaičiavimo tipas</FieldLabel>
              <Select value={form.calculationType} onValueChange={(v) => setForm(f => ({ ...f, calculationType: v }))}>
                <SelectTrigger className={errors.calculationType ? 'border-destructive' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Procentas (%)</SelectItem>
                  <SelectItem value="fixed">Fiksuota suma (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div>
              <FieldLabel required>
                Reikšmė {form.calculationType === 'percentage' ? '(%)' : '(€)'}
              </FieldLabel>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={form.calculationType === 'percentage' ? '100' : undefined}
                value={form.value}
                onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={form.calculationType === 'percentage' ? 'pvz. 2.5' : 'pvz. 1500'}
                className={errors.value ? 'border-destructive' : ''}
              />
              {errors.value && <p className="text-xs text-destructive mt-1">{errors.value}</p>}
            </div>

            {/* VAT mode */}
            <div>
              <FieldLabel required>PVM režimas</FieldLabel>
              <Select value={form.vatMode} onValueChange={(v) => setForm(f => ({ ...f, vatMode: v }))}>
                <SelectTrigger className={errors.vatMode ? 'border-destructive' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="without_vat">Be PVM (PVM pridedamas viršuje)</SelectItem>
                  <SelectItem value="with_vat">Su PVM (kaina jau su PVM)</SelectItem>
                </SelectContent>
              </Select>
              {errors.vatMode && <p className="text-xs text-destructive mt-1">{errors.vatMode}</p>}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Aktyvi</p>
                <p className="text-xs text-muted-foreground">Neaktyvi taisyklė nebus naudojama skaičiuojant</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))}
              />
            </div>

            {/* Preview */}
            {form.value && parseFloat(form.value) > 0 && (
              <div className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Peržiūra</p>
                <p>
                  Nuo €100,000 sandorio →{' '}
                  <strong>
                    {form.calculationType === 'percentage'
                      ? `€${(100000 * parseFloat(form.value) / 100).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`
                      : `€${parseFloat(form.value).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`
                    }
                  </strong>
                  {' '}komisiniai {form.vatMode === 'with_vat' ? '(su PVM)' : '(be PVM, +21% PVM)'}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                {isEdit ? 'Išsaugoti pakeitimus' : 'Sukurti taisyklę'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/commission-rules')}>
                Atšaukti
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}