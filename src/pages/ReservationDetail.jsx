import React, { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, AlertCircle, FileText, CreditCard, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format, isPast, addDays } from 'date-fns';
import { normalizeRole } from '@/lib/constants';
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS, canReleaseReservations, canExtendReservations } from '@/lib/reservationConstants';

export default function ReservationDetail() {
  const context = useOutletContext() || {};
  const { user } = context;
  const { id: reservationId } = useParams();
  const queryClient = useQueryClient();

  const { data: reservation } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => base44.entities.Reservation.filter({ id: reservationId }).then(r => r?.[0]),
    enabled: !!reservationId,
  });

  const { data: bundle } = useQuery({
    queryKey: ['bundle', reservation?.bundleId],
    queryFn: () => base44.entities.ReservationBundle.filter({ id: reservation?.bundleId }).then(r => r?.[0]),
    enabled: !!reservation?.bundleId,
  });

  const { data: unit } = useQuery({
    queryKey: ['unit', bundle?.unitId],
    queryFn: () => base44.entities.SaleUnit.filter({ id: bundle?.unitId }).then(r => r?.[0]),
    enabled: !!bundle?.unitId,
  });

  const { data: components = [] } = useQuery({
    queryKey: ['bundleComponents', bundle?.componentIds],
    queryFn: async () => {
      if (!bundle?.componentIds?.length) return [];
      return base44.entities.UnitComponent.filter({ id: { $in: bundle.componentIds } });
    },
    enabled: !!bundle?.componentIds?.length,
  });

  const { data: client } = useQuery({
    queryKey: ['client', reservation?.clientId],
    queryFn: () => base44.entities.Client.filter({ id: reservation?.clientId }).then(r => r?.[0]),
    enabled: !!reservation?.clientId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', reservation?.projectId],
    queryFn: () => base44.entities.Project.filter({ id: reservation?.projectId }).then(r => r?.[0]),
    enabled: !!reservation?.projectId,
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ['agreements', reservationId],
    queryFn: async () => {
      if (!reservationId) return [];
      return base44.entities.Agreement.filter({ reservationId });
    },
    enabled: !!reservationId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', reservationId],
    queryFn: async () => {
      if (!reservationId) return [];
      return base44.entities.Payment.filter({ reservationId });
    },
    enabled: !!reservationId,
  });

  const { data: deal } = useQuery({
    queryKey: ['deal', reservationId],
    queryFn: async () => {
      if (!reservationId) return null;
      const deals = await base44.entities.Deal.filter({ reservationId });
      return deals?.[0] || null;
    },
    enabled: !!reservationId,
  });

  const [showCreateAgreement, setShowCreateAgreement] = React.useState(false);
  const [showRegisterPayment, setShowRegisterPayment] = React.useState(false);
  const [showCreateDeal, setShowCreateDeal] = React.useState(false);
  const [agreementType, setAgreementType] = React.useState('reservation');
  const [paymentType, setPaymentType] = React.useState('advance');
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [paymentNotes, setPaymentNotes] = React.useState('');

  const releaseReservation = useMutation({
    mutationFn: (reservationId) =>
      base44.functions.invoke('releaseReservation', { reservationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] });
      toast.success('Rezervacija atleista');
    },
    onError: (error) => {
      toast.error(error.message || 'Nepavyko atleisti');
    },
  });

  const extendReservation = useMutation({
    mutationFn: (newExpiresAt) =>
      base44.functions.invoke('extendReservation', { reservationId, newExpiresAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] });
      toast.success('Rezervacija pratęsta');
    },
    onError: (error) => {
      toast.error(error.message || 'Nepavyko pratęsti');
    },
  });

  const createAgreement = useMutation({
    mutationFn: () =>
      base44.functions.invoke('createAgreement', {
        projectId: reservation.projectId,
        reservationId,
        clientId: reservation.clientId,
        agreementType,
        notes: ''
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements', reservationId] });
      setShowCreateAgreement(false);
      toast.success('Sutartis sukurta');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Nepavyko sukurti');
    },
  });

  const signAgreement = useMutation({
    mutationFn: (agreementId) =>
      base44.functions.invoke('signAgreement', { agreementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements', reservationId] });
      toast.success('Sutartis pasirašyta');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Nepavyko pasirašyti');
    },
  });

  const cancelAgreement = useMutation({
    mutationFn: (agreementId) =>
      base44.functions.invoke('cancelAgreement', { agreementId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreements', reservationId] });
      toast.success('Sutartis atšaukta');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Nepavyko atšaukti');
    },
  });

  const registerPayment = useMutation({
    mutationFn: () =>
      base44.functions.invoke('registerPayment', {
        projectId: reservation.projectId,
        clientId: reservation.clientId,
        reservationId,
        paymentType,
        amount: parseFloat(paymentAmount),
        vatRate: 0,
        paidAt: new Date().toISOString(),
        notes: paymentNotes
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', reservationId] });
      setShowRegisterPayment(false);
      setPaymentAmount('');
      setPaymentNotes('');
      toast.success('Mokėjimas registruotas');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Nepavyko registruoti');
    },
  });

  const createDealMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('createDeal', {
        projectId: reservation.projectId,
        unitId: bundle.unitId,
        clientId: reservation.clientId,
        reservationId,
        agreementId: agreements.find(a => a.status === 'signed')?.id,
        soldAt: new Date().toISOString(),
        isDeveloperSale: false
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', reservationId] });
      queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] });
      setShowCreateDeal(false);
      toast.success('Pardavimas sukurtas');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Nepavyko sukurti');
    },
  });

  if (!reservation || !bundle || !unit || !client || !project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Nėra duomenų</p>
      </div>
    );
  }

  const isOverdue = reservation.status === 'overdue' || (isPast(new Date(reservation.expiresAt)) && reservation.status === 'active');
  const normalizedRole = normalizeRole(user?.role);
  const canRelease = canReleaseReservations(normalizedRole);
  const canExtend = canExtendReservations(normalizedRole);
  const canCreateDeal = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(normalizedRole);
  const signedAgreement = agreements.find(a => a.status === 'signed');
  const draftAgreement = agreements.find(a => a.status === 'draft');

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="gap-2 -ml-3">
        <Link to="/reservations"><ArrowLeft className="h-4 w-4" /> Atgal</Link>
      </Button>

      {/* Alert for overdue */}
      {isOverdue && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-700" />
          <AlertDescription className="text-red-700">
            ⚠️ Ši rezervacija yra pasibaigus laikui. Prašome atlikti veiksmą.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{client.fullName}</h2>
                <Badge className={`text-[11px] border ${RESERVATION_STATUS_COLORS[reservation.status]}`}>
                  {RESERVATION_STATUS_LABELS[reservation.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{project.projectName}</p>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-2 justify-end">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(reservation.expiresAt), 'yyyy-MM-dd HH:mm')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bundle / Unit Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objektas ir dedamosios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-medium">{unit.label}</p>
                <p className="text-sm text-muted-foreground">{unit.type}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">€{unit.price}</p>
                <p className="text-xs text-muted-foreground">{unit.areaM2}m²</p>
              </div>
            </div>
          </div>

          {components.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Dedamosios:</p>
              {components.map(comp => (
                <div key={comp.id} className="flex justify-between items-center p-2 rounded-lg bg-card border text-sm">
                  <span>{comp.label} ({comp.type})</span>
                  <span className={comp.includedInPrice ? 'text-green-600' : 'text-muted-foreground'}>
                    {comp.includedInPrice ? 'INCLUDED' : `€${comp.price || '—'}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Suma:</span>
              <span className="font-medium">€{bundle.finalTotalPrice}</span>
            </div>
            {bundle.totalWithVat && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Su PVM:</span>
                <span className="font-medium">€{bundle.totalWithVat}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reservation Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rezervacijos duomenys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Klientas:</span>
            <Link to={`/clients/${client.id}`} className="font-medium hover:underline">
              {client.fullName}
            </Link>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Projektas:</span>
            <span className="font-medium">{project.projectName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Objektas:</span>
            <Link to={`/units/${unit.id}`} className="font-medium hover:underline">
              {unit.label}
            </Link>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rezervavo:</span>
            <span className="font-medium">{reservation.reservedByUserId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rezervuota:</span>
            <span className="font-medium">{format(new Date(reservation.reservedAt), 'yyyy-MM-dd HH:mm')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Baigiasi:</span>
            <span className="font-medium">{format(new Date(reservation.expiresAt), 'yyyy-MM-dd HH:mm')}</span>
          </div>
          {reservation.notes && (
            <div className="mt-3 p-2 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Pastabos:</p>
              <p className="text-sm">{reservation.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Closure Section */}
      {reservation.status !== 'released' && (
        <div className="space-y-4">
          {/* Agreements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Sutartys
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agreements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nėra sutarčių</p>
              ) : (
                agreements.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border text-sm">
                    <div>
                      <span className="font-medium">{a.agreementType === 'reservation' ? 'Rezervacijos' : 'Preliminari'}</span>
                      <Badge variant="outline" className="ml-2 text-[11px]">
                        {a.status === 'draft' ? 'Juodraštis' : a.status === 'signed' ? 'Pasirašyta' : 'Atšaukta'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {a.status === 'draft' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => signAgreement.mutate(a.id)} disabled={signAgreement.isPending}>
                            Pasirašyti
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => cancelAgreement.mutate(a.id)} disabled={cancelAgreement.isPending}>
                            Atšaukti
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
              {!draftAgreement && !signedAgreement && ['active', 'overdue'].includes(reservation.status) && (
                <Dialog open={showCreateAgreement} onOpenChange={setShowCreateAgreement}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <FileText className="h-4 w-4" /> Sukurti sutartį
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Sukurti sutartį</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Sutarties tipas</label>
                        <Select value={agreementType} onValueChange={setAgreementType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reservation">Rezervacijos</SelectItem>
                            <SelectItem value="preliminary">Preliminari</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => createAgreement.mutate()} disabled={createAgreement.isPending} className="w-full">
                        Sukurti
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          {signedAgreement && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Mokėjimai
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nėra mokėjimų</p>
                ) : (
                  payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border text-sm">
                      <div>
                        <span className="font-medium">€{p.amount.toFixed(2)}</span>
                        <span className="text-muted-foreground ml-2">({p.paymentType === 'advance' ? 'Avansas' : 'Kitas'})</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(p.paidAt), 'yyyy-MM-dd')}</span>
                    </div>
                  ))
                )}
                <Dialog open={showRegisterPayment} onOpenChange={setShowRegisterPayment}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <CreditCard className="h-4 w-4" /> Registruoti mokėjimą
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registruoti mokėjimą</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Suma</label>
                        <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Tipas</label>
                        <Select value={paymentType} onValueChange={setPaymentType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="advance">Avansas</SelectItem>
                            <SelectItem value="other">Kita</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => registerPayment.mutate()} disabled={registerPayment.isPending || !paymentAmount} className="w-full">
                        Registruoti
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* Deal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Pardavimas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deal ? (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm font-medium text-green-900">✓ Pardavimas sukurtas</p>
                  <p className="text-xs text-green-700 mt-1">{format(new Date(deal.soldAt), 'yyyy-MM-dd')}</p>
                </div>
              ) : signedAgreement && ['active', 'overdue'].includes(reservation.status) && canCreateDeal ? (
                <Dialog open={showCreateDeal} onOpenChange={setShowCreateDeal}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm" className="w-full gap-2">
                      <DollarSign className="h-4 w-4" /> Finalizuoti pardavimą
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Finalizuoti pardavimą</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm"><span className="text-muted-foreground">Suma:</span> €{bundle.finalTotalPrice}</p>
                      </div>
                      <Button onClick={() => createDealMutation.mutate()} disabled={createDealMutation.isPending} className="w-full">
                        Patvirtinti pardavimą
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : !signedAgreement ? (
                <p className="text-sm text-muted-foreground">Pirmiausia pasirašykite sutartį</p>
              ) : !canCreateDeal ? (
                <p className="text-sm text-muted-foreground">Tik vadybininkai gali finalizuoti pardavimą</p>
              ) : (
                <p className="text-sm text-muted-foreground">Pardavimas negalimas</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {canExtend && ['active', 'overdue'].includes(reservation.status) && (
          <Button
            variant="outline"
            onClick={() => {
              const newDate = addDays(new Date(reservation.expiresAt), 7);
              extendReservation.mutate(newDate.toISOString());
            }}
            disabled={extendReservation.isPending}
          >
            Pratęsti 7 dienomis
          </Button>
        )}
        {canRelease && ['active', 'overdue'].includes(reservation.status) && (
          <Button
            variant="destructive"
            onClick={() => releaseReservation.mutate(reservationId)}
            disabled={releaseReservation.isPending}
          >
            Atleisti
          </Button>
        )}
      </div>
      </div>
      );
      }