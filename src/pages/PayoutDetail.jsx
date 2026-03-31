import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Banknote, Lock, AlertTriangle } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const PAYOUT_STATUS_STYLES = {
  draft:    'bg-secondary text-secondary-foreground',
  approved: 'bg-blue-100 text-blue-800',
  paid:     'bg-green-100 text-green-800'
};
const PAYOUT_STATUS_LABELS = { draft: 'Juodraštis', approved: 'Patvirtinta', paid: 'Išmokėta' };

const COMM_STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  paid:     'bg-green-100 text-green-800'
};
const COMM_STATUS_LABELS = { pending: 'Laukiama', approved: 'Patvirtinta', rejected: 'Atmesta', paid: 'Išmokėta' };

const RECEIPT_LABELS = { not_received: 'Negauta', partially_received: 'Gauta dalinai', fully_received: 'Gauta visiškai' };

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
    queryKey: ['payout-commissions', items.length],
    queryFn: async () => {
      if (!items.length) return [];
      const commIds = items.map(i => i.commissionId);
      const all = await Promise.all(commIds.map(cid => base44.entities.Commission.filter({ id: cid })));
      return all.flat();
    },
    enabled: items.length > 0
  });

  const commMap = Object.fromEntries(allCommissions.map(c => [c.id, c]));

  // Payout lock: any commission where company hasn't received yet
  const lockedCommissions = allCommissions.filter(c =>
    c.role === 'manager' &&
    (c.companyCommissionReceiptStatus || 'not_received') !== 'fully_received'
  );
  const isPayoutLocked = payout?.status === 'draft' && lockedCommissions.length > 0;

  const approveMutation = useMutation({
    mutationFn: () => base44.functions.invoke('approvePayout', { payoutId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout', id] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      toast.success('Išmoka patvirtinta');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const paidMutation = useMutation({
    mutationFn: () => base44.functions.invoke('markPayoutPaid', { payoutId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout', id] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast.success('Išmoka pažymėta kaip sumokėta');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Kraunama...</div>;
  if (!payout) return <div className="p-8 text-center text-muted-foreground">Išmoka nerasta</div>;

  const fmt = (n) => n != null ? `€${Number(n).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/payouts">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Išmoka #{id?.slice(-6)}</h1>
        <Badge className={PAYOUT_STATUS_STYLES[payout.status]}>{PAYOUT_STATUS_LABELS[payout.status]}</Badge>
      </div>

      {/* Payout lock alert */}
      {isPayoutLocked && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-4">
          <Lock className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-800">Išmoka užblokuota</p>
            <p className="text-sm text-orange-700 mt-1">
              Negalima patvirtinti — {lockedCommissions.length === 1 ? '1 komisinis dar' : `${lockedCommissions.length} komisiniai dar`} negautas įmonės.
              Pirmiausia pažymėkite kiekvieno komisinio įmonės gavimą komisinių detalėse.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <Card>
        <CardHeader><CardTitle>Suvestinė</CardTitle></CardHeader>
        <CardContent>
          <InfoRow label="Gavėjas" value={payout.userName || payout.userId} />
          <InfoRow label="Periodas" value={`${payout.periodStart} – ${payout.periodEnd}`} />
          <InfoRow label="Komisinių skaičius" value={payout.itemCount} />
          <InfoRow label="Suma su PVM" value={fmt(payout.totalAmount)} />
          <InfoRow label="PVM suma" value={fmt(payout.totalVat)} />
          <InfoRow label="Suma be PVM" value={fmt(payout.totalWithoutVat)} />
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
            const receiptStatus = comm?.companyCommissionReceiptStatus || 'not_received';
            const receiptLocked = receiptStatus !== 'fully_received';
            return (
              <Link
                key={item.id}
                to={`/commissions/${item.commissionId}`}
                className="flex items-center justify-between py-2.5 px-3 border-b last:border-0 hover:bg-muted/40 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {comm && (
                    <Badge className={COMM_STATUS_STYLES[comm.status] || ''}>
                      {COMM_STATUS_LABELS[comm.status] || comm.status}
                    </Badge>
                  )}
                  <div>
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                      Komisinis #{item.commissionId?.slice(-6)}
                    </p>
                    {comm && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{new Date(comm.calculatedAt).toLocaleDateString('lt-LT')}</span>
                        {receiptLocked && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <Lock className="h-3 w-3" />
                            Įmonė negavo
                          </span>
                        )}
                        {!receiptLocked && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            Įmonė gavo
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{fmt(item.amount)}</p>
                  <p className="text-xs text-muted-foreground">be PVM: {fmt(item.amountWithoutVat)}</p>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      {isAdmin && (
        <div className="flex gap-3">
          {payout.status === 'draft' && (
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || isPayoutLocked}
              className="gap-2"
              title={isPayoutLocked ? 'Negalima — įmonė dar negavo komisinių' : ''}
            >
              {isPayoutLocked ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              {isPayoutLocked ? 'Užblokuota' : 'Patvirtinti'}
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