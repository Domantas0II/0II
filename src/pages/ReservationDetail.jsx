import React from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, AlertCircle } from 'lucide-react';
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

  if (!reservation || !bundle || !unit || !client || !project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Nėra duomenų</p>
      </div>
    );
  }

  const isOverdue = reservation.status === 'overdue' || (isPast(new Date(reservation.expiresAt)) && reservation.status === 'active');
  const canRelease = canReleaseReservations(normalizeRole(user?.role));
  const canExtend = canExtendReservations(normalizeRole(user?.role));

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