import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  paid:     'bg-green-100 text-green-800'
};
const STATUS_LABELS = { pending: 'Laukia', approved: 'Patvirtinta', rejected: 'Atmesta', paid: 'Išmokėta' };

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function CommissionDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const role = normalizeRole(currentUser?.role);
  const canApprove = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commission', id],
    queryFn: () => base44.entities.Commission.filter({ id })
  });
  const commission = commissions[0];

  const { data: deals = [] } = useQuery({
    queryKey: ['deal-for-commission', commission?.dealId],
    queryFn: () => base44.entities.Deal.filter({ id: commission.dealId }),
    enabled: !!commission?.dealId
  });
  const deal = deals[0];

  const approveMutation = useMutation({
    mutationFn: () => base44.functions.invoke('approveCommission', { commissionId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission', id] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast.success('Komisiniai patvirtinti');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const rejectMutation = useMutation({
    mutationFn: () => base44.functions.invoke('rejectCommission', { commissionId: id, reason: rejectReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission', id] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast.success('Komisiniai atmesti');
      setShowRejectForm(false);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Kraunama...</div>;
  if (!commission) return <div className="p-8 text-center text-muted-foreground">Komisiniai nerasti</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/commissions">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Komisiniai</h1>
        <Badge className={STATUS_STYLES[commission.status]}>{STATUS_LABELS[commission.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Finansiniai duomenys</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Suma (su PVM)" value={`€${commission.amount?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`} />
          <InfoRow label="Suma be PVM" value={`€${commission.amountWithoutVat?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`} />
          <InfoRow label="PVM suma" value={`€${commission.vatAmount?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`} />
          <InfoRow label="PVM norma" value={`${commission.vatRate || 21}%`} />
          <InfoRow label="Vaidmuo" value={commission.role} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Deal informacija</CardTitle></CardHeader>
        <CardContent>
          <InfoRow label="Deal ID" value={`#${commission.dealId?.slice(-6)}`} />
          {deal && <>
            <InfoRow label="Deal suma" value={`€${deal.totalAmount?.toLocaleString('lt-LT')}`} />
            <InfoRow label="Projektas" value={deal.projectId} />
          </>}
          <InfoRow label="Paskaičiuota" value={new Date(commission.calculatedAt).toLocaleDateString('lt-LT')} />
          {commission.approvedAt && <InfoRow label="Patvirtinta" value={new Date(commission.approvedAt).toLocaleDateString('lt-LT')} />}
          {commission.paidAt && <InfoRow label="Išmokėta" value={new Date(commission.paidAt).toLocaleDateString('lt-LT')} />}
          {commission.rejectedAt && (
            <>
              <InfoRow label="Atmesta" value={new Date(commission.rejectedAt).toLocaleDateString('lt-LT')} />
              {commission.rejectionReason && <InfoRow label="Priežastis" value={commission.rejectionReason} />}
            </>
          )}
          {commission.payoutId && <InfoRow label="Payout" value={`#${commission.payoutId?.slice(-6)}`} />}
        </CardContent>
      </Card>

      {/* Actions */}
      {canApprove && commission.status === 'pending' && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Patvirtinti
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRejectForm(!showRejectForm)}
              className="gap-2 text-destructive border-destructive"
            >
              <XCircle className="h-4 w-4" />
              Atmesti
            </Button>
          </div>
          {showRejectForm && (
            <div className="space-y-2">
              <Textarea
                placeholder="Atmetimo priežastis (nebūtina)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="h-20"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                Patvirtinti atmetimą
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}