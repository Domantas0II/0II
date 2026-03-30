import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const EMPTY_FORM = {
  name: '',
  projectId: '',
  commissionType: 'percentage',
  commissionValue: '',
  commissionBase: 'without_vat',
  companyPercent: '',
  managerPercent: '',
  hasPartnerSplit: false,
  companyPercentWithPartner: '',
  managerPercentWithPartner: '',
  partnerPercent: '',
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

function SplitPreview({ total, companyP, managerP, partnerP, label }) {
  const commission = total || 0;
  const company = Math.round(commission * (companyP || 0) / 100 * 100) / 100;
  const manager = Math.round(commission * (managerP || 0) / 100 * 100) / 100;
  const partner = partnerP ? Math.round(commission * partnerP / 100 * 100) / 100 : null;
  return (
    <div className="bg-secondary/50 rounded-lg p-3 text-sm space-y-1.5">
      <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Įmonė ({companyP || 0}%)</span>
        <span className="font-medium">€{company.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</span>
        <span className="text-muted-foreground">Vadybininkas ({managerP || 0}%)</span>
        <span className="font-medium text-green-700">€{manager.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</span>
        {partner !== null && (
          <>
            <span className="text-muted-foreground">Partneris ({partnerP}%)</span>
            <span className="font-medium text-blue-700">€{partner.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</span>
          </>
        )}
      </div>
    </div>
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

  const { data: existingRules = [] } = useQuery({
    queryKey: ['commissionRule', id],
    queryFn: () => base44.entities.CommissionRule.filter({ id }),
    enabled: isEdit
  });

  useEffect(() => {
    if (isEdit && existingRules.length > 0) {
      const r = existingRules[0];
      setForm({
        name: r.name || '',
        projectId: r.projectId || '',
        commissionType: r.commissionType || 'percentage',
        commissionValue: r.commissionValue ?? '',
        commissionBase: r.commissionBase || 'without_vat',
        companyPercent: r.companyPercent ?? '',
        managerPercent: r.managerPercent ?? '',
        hasPartnerSplit: !!(r.partnerPercent),
        companyPercentWithPartner: r.companyPercentWithPartner ?? '',
        managerPercentWithPartner: r.managerPercentWithPartner ?? '',
        partnerPercent: r.partnerPercent ?? '',
        vatMode: r.vatMode || 'without_vat',
        isActive: r.isActive !== false
      });
    }
  }, [existingRules, isEdit]);

  const f = (field) => (v) => setForm(prev => ({ ...prev, [field]: v }));
  const fi = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Live preview: total commission on €100,000 deal
  const previewBase = 100000;
  const commissionVal = parseFloat(form.commissionValue) || 0;
  const previewTotal = form.commissionType === 'percentage'
    ? Math.round(previewBase * commissionVal / 100 * 100) / 100
    : commissionVal;

  const noPartnerSplitSum = (parseFloat(form.companyPercent) || 0) + (parseFloat(form.managerPercent) || 0);
  const partnerSplitSum = (parseFloat(form.companyPercentWithPartner) || 0) +
    (parseFloat(form.managerPercentWithPartner) || 0) +
    (parseFloat(form.partnerPercent) || 0);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Privalomas laukas';
    if (!form.commissionType) e.commissionType = 'Privalomas laukas';
    const val = parseFloat(form.commissionValue);
    if (!form.commissionValue || isNaN(val) || val <= 0) e.commissionValue = 'Turi būti > 0';
    if (form.commissionType === 'percentage' && val > 100) e.commissionValue = 'Procentas negali viršyti 100';

    const cP = parseFloat(form.companyPercent);
    const mP = parseFloat(form.managerPercent);
    if (isNaN(cP) || isNaN(mP)) { e.companyPercent = 'Privalomas laukas'; e.managerPercent = 'Privalomas laukas'; }
    else if (Math.abs(cP + mP - 100) > 0.01) e.companyPercent = `Suma turi būti 100% (dabar ${cP + mP}%)`;

    if (form.hasPartnerSplit) {
      const cp = parseFloat(form.companyPercentWithPartner);
      const mp = parseFloat(form.managerPercentWithPartner);
      const pp = parseFloat(form.partnerPercent);
      if (isNaN(cp) || isNaN(mp) || isNaN(pp)) {
        e.partnerPercent = 'Visi 3 laukai privalomi';
      } else if (Math.abs(cp + mp + pp - 100) > 0.01) {
        e.partnerPercent = `Suma turi būti 100% (dabar ${cp + mp + pp}%)`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: () => base44.functions.invoke('upsertCommissionRule', {
      ...(isEdit ? { id } : {}),
      name: form.name.trim(),
      projectId: form.projectId || null,
      commissionType: form.commissionType,
      commissionValue: parseFloat(form.commissionValue),
      commissionBase: form.commissionBase,
      companyPercent: parseFloat(form.companyPercent),
      managerPercent: parseFloat(form.managerPercent),
      ...(form.hasPartnerSplit ? {
        companyPercentWithPartner: parseFloat(form.companyPercentWithPartner),
        managerPercentWithPartner: parseFloat(form.managerPercentWithPartner),
        partnerPercent: parseFloat(form.partnerPercent)
      } : {}),
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
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/commission-rules">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">{isEdit ? 'Redaguoti taisyklę' : 'Nauja komisinių taisyklė'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* --- KOMISINIO GENERAVIMAS --- */}
        <Card>
          <CardHeader><CardTitle className="text-base">1. Komisinio dydis</CardTitle></CardHeader>
          <CardContent className="space-y-4">

            <div>
              <FieldLabel required>Pavadinimas</FieldLabel>
              <Input
                value={form.name}
                onChange={fi('name')}
                placeholder="pvz. Standartinė 3%"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <FieldLabel>Projektas (tuščias = globali taisyklė)</FieldLabel>
              <Select value={form.projectId || '__global__'} onValueChange={(v) => f('projectId')(v === '__global__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">🌐 Globali (visi projektai)</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Tipas</FieldLabel>
                <Select value={form.commissionType} onValueChange={f('commissionType')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Procentas (%)</SelectItem>
                    <SelectItem value="fixed">Fiksuota suma (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel required>Reikšmė {form.commissionType === 'percentage' ? '(%)' : '(€)'}</FieldLabel>
                <Input
                  type="number" step="0.01" min="0.01"
                  max={form.commissionType === 'percentage' ? '100' : undefined}
                  value={form.commissionValue}
                  onChange={fi('commissionValue')}
                  placeholder={form.commissionType === 'percentage' ? 'pvz. 3' : 'pvz. 3000'}
                  className={errors.commissionValue ? 'border-destructive' : ''}
                />
                {errors.commissionValue && <p className="text-xs text-destructive mt-1">{errors.commissionValue}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Skaičiavimo bazė</FieldLabel>
                <Select value={form.commissionBase} onValueChange={f('commissionBase')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="without_vat">Be PVM</SelectItem>
                    <SelectItem value="with_vat">Su PVM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>PVM režimas (išmokant)</FieldLabel>
                <Select value={form.vatMode} onValueChange={f('vatMode')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="without_vat">Be PVM</SelectItem>
                    <SelectItem value="with_vat">Su PVM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* --- SPLIT BE PARTNERIO --- */}
        <Card>
          <CardHeader><CardTitle className="text-base">2. Padalijimas — be partnerio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Įmonė (%)</FieldLabel>
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={form.companyPercent}
                  onChange={fi('companyPercent')}
                  placeholder="pvz. 70"
                  className={errors.companyPercent ? 'border-destructive' : ''}
                />
              </div>
              <div>
                <FieldLabel required>Vadybininkas (%)</FieldLabel>
                <Input
                  type="number" step="0.01" min="0" max="100"
                  value={form.managerPercent}
                  onChange={fi('managerPercent')}
                  placeholder="pvz. 30"
                  className={errors.managerPercent ? 'border-destructive' : ''}
                />
              </div>
            </div>
            {errors.companyPercent && <p className="text-xs text-destructive">{errors.companyPercent}</p>}
            {noPartnerSplitSum > 0 && (
              <p className={`text-xs ${Math.abs(noPartnerSplitSum - 100) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                Suma: {noPartnerSplitSum}% {Math.abs(noPartnerSplitSum - 100) < 0.01 ? '✓' : '(turi būti 100%)'}
              </p>
            )}

            {previewTotal > 0 && Math.abs(noPartnerSplitSum - 100) < 0.01 && (
              <SplitPreview
                total={previewTotal}
                companyP={parseFloat(form.companyPercent)}
                managerP={parseFloat(form.managerPercent)}
                label={`Peržiūra — €${previewBase.toLocaleString()} sandoris → komisinis €${previewTotal.toLocaleString()}`}
              />
            )}
          </CardContent>
        </Card>

        {/* --- SPLIT SU PARTNERIU --- */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">3. Padalijimas — su partneriu</CardTitle>
              <Switch checked={form.hasPartnerSplit} onCheckedChange={f('hasPartnerSplit')} />
            </div>
          </CardHeader>
          {form.hasPartnerSplit && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel required>Įmonė (%)</FieldLabel>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.companyPercentWithPartner}
                    onChange={fi('companyPercentWithPartner')}
                    placeholder="pvz. 60"
                  />
                </div>
                <div>
                  <FieldLabel required>Vadybininkas (%)</FieldLabel>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.managerPercentWithPartner}
                    onChange={fi('managerPercentWithPartner')}
                    placeholder="pvz. 25"
                  />
                </div>
                <div>
                  <FieldLabel required>Partneris (%)</FieldLabel>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.partnerPercent}
                    onChange={fi('partnerPercent')}
                    placeholder="pvz. 15"
                  />
                </div>
              </div>
              {errors.partnerPercent && <p className="text-xs text-destructive">{errors.partnerPercent}</p>}
              {partnerSplitSum > 0 && (
                <p className={`text-xs ${Math.abs(partnerSplitSum - 100) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                  Suma: {partnerSplitSum}% {Math.abs(partnerSplitSum - 100) < 0.01 ? '✓' : '(turi būti 100%)'}
                </p>
              )}
              {previewTotal > 0 && Math.abs(partnerSplitSum - 100) < 0.01 && (
                <SplitPreview
                  total={previewTotal}
                  companyP={parseFloat(form.companyPercentWithPartner)}
                  managerP={parseFloat(form.managerPercentWithPartner)}
                  partnerP={parseFloat(form.partnerPercent)}
                  label={`Su partneriu — €${previewBase.toLocaleString()} → komisinis €${previewTotal.toLocaleString()}`}
                />
              )}
            </CardContent>
          )}
        </Card>

        {/* --- AKTYVUMAS --- */}
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Aktyvi taisyklė</p>
              <p className="text-xs text-muted-foreground">Neaktyvi nebus naudojama skaičiuojant</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={f('isActive')} />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saveMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {isEdit ? 'Išsaugoti pakeitimus' : 'Sukurti taisyklę'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/commission-rules')}>
            Atšaukti
          </Button>
        </div>
      </form>
    </div>
  );
}