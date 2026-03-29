import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, XCircle, Building, User, Banknote, ThumbsUp } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  paid:     'bg-green-100 text-green-800'
};
const STATUS_LABELS = { pending: 'Laukia', approved: 'Patvirtinta', rejected: 'Atmesta', paid: 'Išmokėta' };

const RECEIPT_STYLES = {
  not_received:       'bg-gray-100 text-gray-700',
  partially_received: 'bg-yellow-100 text-yellow-800',
  fully_received:     'bg-green-100 text-green-800'
};
const RECEIPT_LABELS = { not_received: 'Negauta', partially_received: 'Gauta dalinai', fully_received: 'Gauta visiškai' };

const PAYOUT_STYLES = {
  not_payable_yet: 'bg-gray-100 text-gray-700',
  payable:         'bg-blue-100 text-blue-800',
  paid:            'bg-green-100 text-green-800'
};
const PAYOUT_LABELS = { not_payable_yet: 'Dar neleidžiama', payable: 'Galima išmokėti', paid: 'Išmokėta' };

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
  const isAgent = role === 'SALES_AGENT';

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

  const { data: projects = [] } = useQuery({
    queryKey: ['project-for-commission', commission?.projectId],
    queryFn: () => base44.entities.Project.filter({ id: commission.projectId }),
    enabled: !!commission?.projectId
  });
  const project = projects[0];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['commission', id] });
    queryClient.invalidateQueries({ queryKey: ['commissions'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => base44.functions.invoke('approveCommission', { commissionId: id }),
    onSuccess: () => { invalidate(); toast.success('Komisiniai patvirtinti'); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const rejectMutation = useMutation({
    mutationFn: () => base44.functions.invoke('rejectCommission', { commissionId: id, reason: rejectReason }),
    onSuccess: () => { invalidate(); toast.success('Komisiniai atmesti'); setShowRejectForm(false); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const markReceivedMutation = useMutation({
    mutationFn: () => base44.functions.invoke('markCompanyCommissionReceived', { commissionId: id }),
    onSuccess: () => { invalidate(); toast.success('Komisinis pažymėtas kaip gautas'); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const markPaidMutation = useMutation({
    mutationFn: () => base44.functions.invoke('markManagerPayoutPaid', { commissionId: id }),
    onSuccess: () => { invalidate(); toast.success('Vadybininkui išmokėta'); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  const confirmReceivedMutation = useMutation({
    mutationFn: () => base44.functions.invoke('confirmManagerPayoutReceived', { commissionId: id }),
    onSuccess: () => { invalidate(); toast.success('Patvirtinta, kad gavote išmoką'); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Kraunama...</div>;
  if (!commission) return <div className="p-8 text-center text-muted-foreground">Komisiniai nerasti</div>;

  const fmt = (n) => n != null ? `€${Number(n).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}` : '—';
  const fmtPct = (n) => n != null ? `${n}%` : '—';

  const isCommissionOwner = currentUser?.id === commission.userId;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/commissions">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Komisiniai</h1>
        <Badge className={STATUS_STYLES[commission.status]}>{STATUS_LABELS[commission.status]}</Badge>
      </div>

      {/* A. Pardavimo bazė */}
      <SectionCard title="Pardavimo bazė ir komisinis">
        <InfoRow label="Projektas" value={project ? project.projectName : (commission.projectId ? `ID: ${commission.projectId.slice(-6)}` : '—')} />
        <InfoRow label="Deal ID" value={`#${commission.dealId?.slice(-6)}`} />
        {deal && <InfoRow label="Deal suma" value={fmt(deal.totalAmount)} />}
        <InfoRow label="Pardavimo bazė (obj. + priklausiniai)" value={fmt(commission.saleBaseAmount)} />
        <InfoRow label="Komisinio procentas" value={fmtPct(commission.commissionPercentApplied)} />
        <InfoRow label="Bendras komisinis" value={fmt(commission.totalCommissionBaseAmount)} />
        <InfoRow label="Paskaičiuota" value={new Date(commission.calculatedAt).toLocaleDateString('lt-LT')} />
      </SectionCard>

      {/* B. Split */}
      <SectionCard title="Komisinio paskirstymas" icon={Building}>
        <InfoRow label="Įmonės dalis" value={`${fmtPct(commission.companyCommissionSharePercent)} → ${fmt(commission.companyCommissionAmount)}`} />
        <InfoRow label="Vadybininko dalis" value={`${fmtPct(commission.managerCommissionSharePercent)} → ${fmt(commission.managerCommissionAmount)}`} />
      </SectionCard>

      {/* C. Manager VAT */}
      <SectionCard title="Vadybininko PVM režimas" icon={User}>
        <InfoRow label="PVM režimas" value={commission.managerVatMode === 'with_vat' ? 'PVM mokėtojas' : 'Ne PVM mokėtojas'} />
        {commission.managerVatMode === 'with_vat' ? (
          <>
            <InfoRow label="Suma be PVM" value={fmt(commission.managerCommissionAmountWithoutVat)} />
            <InfoRow label="PVM suma" value={fmt(commission.managerCommissionVatAmount)} />
            <InfoRow label="Suma su PVM" value={fmt(commission.managerCommissionAmountWithVat)} />
          </>
        ) : (
          <InfoRow label="Išmoka" value={fmt(commission.managerCommissionAmount)} />
        )}
      </SectionCard>

      {/* D. Company receipt */}
      <SectionCard title="Įmonės komisinio gavimas" icon={Building}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Statusas</span>
          <Badge className={RECEIPT_STYLES[commission.companyCommissionReceiptStatus]}>
            {RECEIPT_LABELS[commission.companyCommissionReceiptStatus]}
          </Badge>
        </div>
        {commission.companyCommissionReceivedAt && (
          <InfoRow label="Gauta" value={new Date(commission.companyCommissionReceivedAt).toLocaleDateString('lt-LT')} />
        )}
        {canApprove && commission.companyCommissionReceiptStatus !== 'fully_received' && (
          <Button
            size="sm"
            className="mt-3 w-full gap-2"
            onClick={() => markReceivedMutation.mutate()}
            disabled={markReceivedMutation.isPending}
          >
            <CheckCircle className="h-4 w-4" />
            Pažymėti: visas komisinis gautas
          </Button>
        )}
      </SectionCard>

      {/* E. Manager payout */}
      <SectionCard title="Vadybininko išmoka" icon={Banknote}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Statusas</span>
          <Badge className={PAYOUT_STYLES[commission.managerPayoutStatus]}>
            {PAYOUT_LABELS[commission.managerPayoutStatus]}
          </Badge>
        </div>
        {commission.managerPayoutAllowedAt && (
          <InfoRow label="Leista išmokėti" value={new Date(commission.managerPayoutAllowedAt).toLocaleDateString('lt-LT')} />
        )}
        {commission.managerPayoutPaidAt && (
          <InfoRow label="Išmokėta" value={new Date(commission.managerPayoutPaidAt).toLocaleDateString('lt-LT')} />
        )}
        {canApprove && commission.managerPayoutStatus === 'payable' && (
          <Button
            size="sm"
            className="mt-3 w-full gap-2"
            onClick={() => markPaidMutation.mutate()}
            disabled={markPaidMutation.isPending}
          >
            <Banknote className="h-4 w-4" />
            Pažymėti: vadybininkui išmokėta
          </Button>
        )}
      </SectionCard>

      {/* F. Manager confirmation */}
      {commission.managerPayoutStatus === 'paid' && (
        <SectionCard title="Vadybininko patvirtinimas" icon={ThumbsUp}>
          {commission.managerPayoutReceivedConfirmedAt ? (
            <InfoRow
              label="Patvirtinta"
              value={new Date(commission.managerPayoutReceivedConfirmedAt).toLocaleDateString('lt-LT')}
            />
          ) : (
            (isCommissionOwner || isAgent) && (
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={() => confirmReceivedMutation.mutate()}
                disabled={confirmReceivedMutation.isPending}
              >
                <ThumbsUp className="h-4 w-4" />
                Patvirtinti, kad gavau išmoką
              </Button>
            )
          )}
        </SectionCard>
      )}

      {/* Approve / Reject */}
      {canApprove && commission.status === 'pending' && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Komisinio patvirtinimas</p>
            <div className="flex gap-3">
              <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="gap-2">
                <CheckCircle className="h-4 w-4" />Patvirtinti
              </Button>
              <Button variant="outline" onClick={() => setShowRejectForm(!showRejectForm)} className="gap-2 text-destructive border-destructive">
                <XCircle className="h-4 w-4" />Atmesti
              </Button>
            </div>
            {showRejectForm && (
              <div className="space-y-2">
                <Textarea placeholder="Atmetimo priežastis (nebūtina)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="h-20" />
                <Button variant="destructive" size="sm" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                  Patvirtinti atmetimą
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rejection info */}
      {commission.status === 'rejected' && (
        <Card className="border-destructive/30">
          <CardContent className="pt-5">
            <InfoRow label="Atmesta" value={commission.rejectedAt ? new Date(commission.rejectedAt).toLocaleDateString('lt-LT') : '—'} />
            {commission.rejectionReason && <InfoRow label="Priežastis" value={commission.rejectionReason} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}