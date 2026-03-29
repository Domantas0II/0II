import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Banknote } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const PAYOUT_STATUS_STYLES = {
  draft:    'bg-secondary text-secondary-foreground',
  approved: 'bg-blue-100 text-blue-800',
  paid:     'bg-green-100 text-green-800'
};
const PAYOUT_STATUS_LABELS = { draft: 'Juodraštis', approved: 'Patvirtinta', paid: 'Išmokėta' };

const COMM_STATUS_STYLES = {
  approved: 'bg-blue-100 text-blue-800',
  paid:     'bg-green-100 text-green-800'
};

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function PayoutDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin = normalizeRole(currentUser?.role) === 'ADMINISTRATOR';

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['payout', id],
    queryFn: () => base44.entities.Payout.filter({ id })
  });
  const payout = payouts[0];

  const { data: items = [] } = useQuery({
    queryKey: ['payout-items', id],
    queryFn: () => base44.entities.PayoutItem.filter({ payoutId: id }),
    enabled: !!id
  });

  const { data: allCommissions = [] } = useQuery({
    queryKey: ['payout-commissions', id],
    queryFn: async () => {
      if (!items.length) return [];
      const commIds = items.map(i => i.commissionId);
      const all = await Promise.all(commIds.map(cid => base44.entities.Commission.filter({ id: cid })));
      return all.flat();
    },
    enabled: items.length > 0
  });

  const commMap = Object.fromEntries(allCommissions.map(c => [c.id, c]));

  const approveMutation = useMutation({
    mutationFn: () => base44.functions.invoke('approvePayout', { payoutId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout', id] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      toast.success('Payout patvirtintas');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const paidMutation = useMutation({
    mutationFn: () => base44.functions.invoke('markPayoutPaid', { payoutId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout', id] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast.success('Payout pažymėtas kaip išmokėtas');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Kraunama...</div>;
  if (!payout) return <div className="p-8 text-center text-muted-foreground">Payout nerastas</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/payouts">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Payout #{id?.slice(-6)}</h1>
        <Badge className={PAYOUT_STATUS_STYLES[payout.status]}>{PAYOUT_STATUS_LABELS[payout.status]}</Badge>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader><CardTitle>Suvestinė</CardTitle></CardHeader>
        <CardContent>
          <InfoRow label="Gavėjas" value={payout.userName || payout.userId} />
          <InfoRow label="Periodas" value={`${payout.periodStart} – ${payout.periodEnd}`} />
          <InfoRow label="Komisinių skaičius" value={payout.itemCount} />
          <InfoRow label="Suma su PVM" value={`€${payout.totalAmount?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`} />
          <InfoRow label="PVM suma" value={`€${payout.totalVat?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`} />
          <InfoRow label="Suma be PVM" value={`€${payout.totalWithoutVat?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`} />
          {payout.approvedAt && <InfoRow label="Patvirtinta" value={new Date(payout.approvedAt).toLocaleDateString('lt-LT')} />}
          {payout.paidAt && <InfoRow label="Išmokėta" value={new Date(payout.paidAt).toLocaleDateString('lt-LT')} />}
        </CardContent>
      </Card>

      {/* Commission items */}
      <Card>
        <CardHeader><CardTitle>Komisiniai ({items.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map(item => {
            const comm = commMap[item.commissionId];
            return (
              <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  {comm && <Badge className={COMM_STATUS_STYLES[comm.status] || ''}>{comm.status}</Badge>}
                  <div>
                    <p className="text-sm font-medium">Deal #{item.commissionId?.slice(-6)}</p>
                    {comm && <p className="text-xs text-muted-foreground">{new Date(comm.calculatedAt).toLocaleDateString('lt-LT')}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">€{item.amount?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground">be PVM: €{item.amountWithoutVat?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      {isAdmin && (
        <div className="flex gap-3">
          {payout.status === 'draft' && (
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Patvirtinti
            </Button>
          )}
          {payout.status === 'approved' && (
            <Button onClick={() => paidMutation.mutate()} disabled={paidMutation.isPending} className="gap-2">
              <Banknote className="h-4 w-4" />
              Pažymėti išmokėtu
            </Button>
          )}
        </div>
      )}
    </div>
  );
}