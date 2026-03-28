import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { canAccessInbound, normalizeRole } from '@/lib/constants';
import { getAccessibleProjectIds, filterByAccessibleProjects } from '@/lib/queryAccess';

export default function CreateReservation() {
  const context = useOutletContext() || {};
  const { user } = context;
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    clientId: '',
    projectId: '',
    unitId: '',
    componentIds: [],
    expiresAt: format(addDays(new Date(), 30), "yyyy-MM-dd'T'HH:mm"),
    notes: ''
  });
  const [validationError, setValidationError] = useState('');

  const canAccess = canAccessInbound(normalizeRole(user?.role));
  if (!canAccess) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos</div>;
  }

  // Fetch data
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.Project.list();
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', form.projectId],
    queryFn: async () => {
      if (!form.projectId) return [];
      const all = await base44.entities.SaleUnit.filter({ projectId: form.projectId });
      return all.filter(u => u.internalStatus === 'available');
    },
    enabled: !!form.projectId,
  });

  const { data: components = [] } = useQuery({
    queryKey: ['components', form.projectId, form.unitId],
    queryFn: async () => {
      if (!form.projectId) return [];
      const all = await base44.entities.UnitComponent.filter({ projectId: form.projectId });
      return all.filter(c => c.status === 'available' && c.unitId !== form.unitId);
    },
    enabled: !!form.projectId,
  });

  const { data: selectedUnit } = useQuery({
    queryKey: ['unit', form.unitId],
    queryFn: () => base44.entities.SaleUnit.filter({ id: form.unitId }).then(r => r?.[0]),
    enabled: !!form.unitId,
  });

  const validateReservation = useMutation({
    mutationFn: (data) =>
      base44.functions.invoke('validateReservation', data),
  });

  const createBundle = useMutation({
    mutationFn: async (data) => {
      const bundle = await base44.entities.ReservationBundle.create(data);
      return bundle;
    },
  });

  const createRes = useMutation({
    mutationFn: (data) =>
      base44.functions.invoke('createReservation', data),
    onSuccess: (res) => {
      toast.success('Rezervacija sukurta');
      navigate('/reservations');
    },
    onError: (error) => {
      toast.error(error.message || 'Nepavyko sukurti rezervacijos');
    },
  });

  const handleCreateReservation = async () => {
    if (!form.clientId || !form.projectId || !form.unitId) {
      setValidationError('Privalomi laukai:Klientas, Projektas, Objektas');
      return;
    }

    // Validate
    try {
      const validRes = await validateReservation.mutateAsync({
        projectId: form.projectId,
        unitId: form.unitId,
        componentIds: form.componentIds
      });
      if (!validRes.data.valid) {
        setValidationError('Objektas arba dedamosios negalimos');
        return;
      }
    } catch (err) {
      setValidationError(err.message);
      return;
    }

    // Create bundle
    try {
      const bundleData = {
        projectId: form.projectId,
        unitId: form.unitId,
        componentIds: form.componentIds,
        baseUnitPrice: selectedUnit?.price || 0,
        componentsTotalPrice: 0,
        finalTotalPrice: selectedUnit?.price || 0,
        createdByUserId: user.id
      };

      const bundle = await createBundle.mutateAsync(bundleData);

      // Get clientProjectInterest
      const interests = await base44.entities.ClientProjectInterest.filter({
        clientId: form.clientId,
        projectId: form.projectId
      });

      if (!interests || interests.length === 0) {
        setValidationError('Klienduinėras nėra susidominutis šiuo projektu');
        return;
      }

      // Create reservation
      const resData = {
        projectId: form.projectId,
        bundleId: bundle.id,
        clientId: form.clientId,
        clientProjectInterestId: interests[0].id,
        expiresAt: form.expiresAt,
        notes: form.notes
      };

      await createRes.mutateAsync(resData);
    } catch (err) {
      setValidationError(err.message);
    }
  };

  const selectedClient = clients.find(c => c.id === form.clientId);
  const selectedProject = projects.find(p => p.id === form.projectId);

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="gap-2 -ml-3">
        <ArrowLeft className="h-4 w-4" onClick={() => navigate('/reservations')} /> Atgal
      </Button>

      {validationError && (
        <Alert className="border-destructive bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Client */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Pasirinkti klientą</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Pasirinkite klientą..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Step 2: Project */}
      {selectedClient && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Pasirinkti projektą</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={form.projectId} onValueChange={v => setForm({ ...form, projectId: v, unitId: '', componentIds: [] })}>
              <SelectTrigger>
                <SelectValue placeholder="Pasirinkite projektą..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Unit */}
      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Pasirinkti objektą</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={form.unitId} onValueChange={v => setForm({ ...form, unitId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Pasirinkite objektą..." />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.label} - €{u.price}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Components */}
      {selectedUnit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Pridėti dedamąsias (neprivaloma)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select onValueChange={v => {
              if (!form.componentIds.includes(v)) {
                setForm({ ...form, componentIds: [...form.componentIds, v] });
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Pridėti dedamąją..." />
              </SelectTrigger>
              <SelectContent>
                {components
                  .filter(c => !form.componentIds.includes(c.id))
                  .map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.label} ({c.type})</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              {form.componentIds.map(cId => {
                const comp = components.find(c => c.id === cId);
                return (
                  <div key={cId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border">
                    <span className="text-sm">{comp?.label} ({comp?.type})</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, componentIds: form.componentIds.filter(id => id !== cId) })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review & Expiration */}
      {selectedUnit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">5. Peržiūrėti ir nustatyti galiojimą</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Objektas:</span>
                <span className="font-medium">{selectedUnit.label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kaina:</span>
                <span className="font-medium">€{selectedUnit.price}</span>
              </div>
              {form.componentIds.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dedamosios:</span>
                  <span className="font-medium">{form.componentIds.length}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Baigiasi:</label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Pastabos (neprivaloma):</label>
              <Input
                placeholder="Pastabos..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/reservations')} className="flex-1">
                Atšaukti
              </Button>
              <Button
                onClick={handleCreateReservation}
                disabled={createRes.isPending}
                className="flex-1"
              >
                Sukurti rezervaciją
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}