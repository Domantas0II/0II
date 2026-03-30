import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { canAccessInbound, normalizeRole } from '@/lib/constants';
import { getAccessibleProjectIds } from '@/lib/queryAccess';
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUS_COLORS, canReleaseReservations, canExtendReservations } from '@/lib/reservationConstants';

export default function ReservationsList() {
  const context = useOutletContext() || {};
  const { user } = context;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', project: 'all', status: 'all' });

  const canAccess = canAccessInbound(normalizeRole(user?.role));

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.Project.list('-created_date', 50);
      return base44.entities.Project.filter({ id: { $in: accessibleIds } });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.Reservation.list('-created_date', 50);
      return base44.entities.Reservation.filter({ 
        projectId: { $in: accessibleIds } 
      });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: bundles = [] } = useQuery({
    queryKey: ['reservationBundles', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.ReservationBundle.list('-created_date', 50);
      return base44.entities.ReservationBundle.filter({ 
        projectId: { $in: accessibleIds } 
      });
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 200),
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.SaleUnit.list('-created_date', 100);
      return base44.entities.SaleUnit.filter({ projectId: { $in: accessibleIds } });
    },
    enabled: accessibleIds !== undefined,
  });

  const releaseReservation = useMutation({
    mutationFn: (reservationId) =>
      base44.functions.invoke('releaseReservation', { reservationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Rezervacija atšaukta');
    },
    onError: (error) => {
      toast.error(error.message || 'Nepavyko atleisti');
    },
  });

  if (!canAccess) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos</div>;
  }

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const bundleMap = Object.fromEntries(bundles.map(b => [b.id, b]));
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));

  const filtered = reservations.filter(r => {
    if (filters.search && !clientMap[r.clientId]?.fullName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.project !== 'all' && r.projectId !== filters.project) return false;
    if (filters.status !== 'all' && r.status !== filters.status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rezervacijos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length === 1 ? '1 rezervacija' : filtered.length >= 2 && filtered.length <= 9 ? `${filtered.length} rezervacijos` : `${filtered.length} rezervacijų`}
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/reservation-create">
            <Plus className="h-4 w-4" /> Nauja
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ieškoti pagal kliento vardą..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={filters.project} onValueChange={v => setFilters(prev => ({ ...prev, project: v }))}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card">
            <SelectValue placeholder="Visi projektai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi projektai</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={v => setFilters(prev => ({ ...prev, status: v }))}>
          <SelectTrigger className="w-full sm:w-[140px] bg-card">
            <SelectValue placeholder="Statusas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi statusai</SelectItem>
            {Object.entries(RESERVATION_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-20">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Nėra rezervacijų</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(reservation => {
            const bundle = bundleMap[reservation.bundleId];
            const client = clientMap[reservation.clientId];
            const project = projectMap[reservation.projectId];
            const unit = unitMap[bundle?.unitId];
            const isOverdue = reservation.status === 'overdue';
            const canRelease = canReleaseReservations(normalizeRole(user?.role));
            const canExtend = canExtendReservations(normalizeRole(user?.role));

            return (
              <Card key={reservation.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link to={`/reservation/${reservation.id}`} className="font-medium hover:underline">
                        {client?.fullName}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted-foreground">{project?.projectName}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{unit?.label}</span>
                        <Badge variant="outline" className={`text-[11px] border ${RESERVATION_STATUS_COLORS[reservation.status]}`}>
                          {RESERVATION_STATUS_LABELS[reservation.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Baigiasi: {format(new Date(reservation.expiresAt), 'yyyy-MM-dd HH:mm')}
                        {isOverdue && (
                          <span className="ml-2 text-red-600">⚠️ Pasibaigus laikui</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {canExtend && ['active', 'overdue'].includes(reservation.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newDate = new Date(reservation.expiresAt);
                            newDate.setDate(newDate.getDate() + 7);
                            base44.functions.invoke('extendReservation', {
                              reservationId: reservation.id,
                              newExpiresAt: newDate.toISOString()
                            }).then(() => {
                              queryClient.invalidateQueries({ queryKey: ['reservations'] });
                              toast.success('Rezervacija pratęsta');
                            }).catch(err => toast.error(err.message));
                          }}
                        >
                          Pratęsti
                        </Button>
                      )}
                      {canRelease && ['active', 'overdue'].includes(reservation.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => releaseReservation.mutate(reservation.id)}
                          disabled={releaseReservation.isPending}
                        >
                          Atšaukti
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/reservation/${reservation.id}`}>Peržiūra</Link>
                      </Button>
                    </div>
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