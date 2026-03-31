import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, XCircle, Building, User, Banknote, ThumbsUp, Lock, AlertTriangle } from 'lucide-react';

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

function SectionCard({ title, icon: IconComp, children, className }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {IconComp && <IconComp className="h-4 w-4 text-muted-foreground" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Split vizualizacija — progress bar su procentais ir sumomis
 */
function SplitBar({ label, percent, amount, color }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">
          {percent != null ? `${percent}%` : '—'}
          {amount != null ? ` → €${Number(amount).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}` : ''}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(percent || 0, 100)}%` }}
        />
      </div>
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

  // Fetch sibling commissions (same deal — to show partner if exists)
  const { data: siblingCommissions = [] } = useQuery({
    queryKey: ['commissions-for-deal', commission?.dealId],
    queryFn: () => base44.entities.Commission.filter({ dealId: commission.dealId }),
    enabled: !!commission?.dealId
  });

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
  const isCommissionOwner = currentUser?.id === commission.userId;
  const isPartnerCommission = commission.role === 'partner';

  // Payout lock check
  const receiptStatus = commission.companyCommissionReceiptStatus || 'not_received';
  const payoutStatus = commission.managerPayoutStatus || 'not_payable_yet';
  const isPayoutLocked = payoutStatus === 'not_payable_yet';
  const isPayoutPayable = payoutStatus === 'payable';
  const isPayoutPaid = payoutStatus === 'paid';

  // Split procentai iš rule arba iš komisinio duomenų
  const agentPercent = commission.sharePercent;
  const companyAmount = commission.companyAmount;
  const agentAmount = commission.amount;
  const totalCommission = commission.totalCommission;
  const companyPercent = totalCommission > 0 && companyAmount != null
    ? Math.round(companyAmount / totalCommission * 100 * 10) / 10
    : null;

  // Sibling partner commission
  const partnerCommission = siblingCommissions.find(c => c.role === 'partner' && c.id !== id);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/commissions">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isPartnerCommission ? 'Partnerio komisiniai' : 'Vadybininko komisiniai'}
        </h1>
        <Badge className={STATUS_STYLES[commission.status]}>{STATUS_LABELS[commission.status]}</Badge>
      </div>

      {/* A. Pardavimo bazė + bendras komisinis */}
      <SectionCard title="Pardavimo bazė ir bendras komisinis">
        <InfoRow label="Projektas" value={project?.projectName || '—'} />
        {deal && <InfoRow label="Pardavimo suma" value={fmt(deal.totalAmount)} />}
        <InfoRow label="Skaičiavimo bazė" value={fmt(commission.saleBaseAmount)} />
        <InfoRow label="Bendras komisinis (TOTAL)" value={<span className="font-bold text-foreground">{fmt(totalCommission)}</span>} />
        <InfoRow label="Paskaičiuota" value={commission.calculatedAt ? new Date(commission.calculatedAt).toLocaleDateString('lt-LT') : '—'} />
      </SectionCard>

      {/* B. Split vizualizacija */}
      <SectionCard title="Komisinio paskirstymas" icon={Building}>
        <div className="space-y-4 mb-4">
          {!isPartnerCommission && (
            <>
              <SplitBar
                label="Įmonė"
                percent={companyPercent}
                amount={companyAmount}
                color="bg-slate-500"
              />
              <SplitBar
                label="Vadybininkas"
                percent={agentPercent}
                amount={agentAmount}
                color="bg-primary"
              />
              {partnerCommission && (
                <SplitBar
                  label="Partneris"
                  percent={partnerCommission.sharePercent}
                  amount={partnerCommission.amount}
                  color="bg-blue-500"
                />
              )}
            </>
          )}
          {isPartnerCommission && (
            <SplitBar
              label="Partneris"
              percent={agentPercent}
              amount={agentAmount}
              color="bg-blue-500"
            />
          )}
        </div>

        {/* Teksto summary */}
        {!isPartnerCommission && companyPercent != null && (
          <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
            Įmonė {companyPercent}% / Vadybininkas {agentPercent}%
            {partnerCommission ? ` / Partneris ${partnerCommission.sharePercent}%` : ''}
          </div>
        )}
      </SectionCard>

      {/* C. Vadybininko PVM */}
      {!isPartnerCommission && (
        <SectionCard title="Vadybininko PVM režimas" icon={User}>
          <InfoRow label="PVM režimas" value={commission.vatMode === 'with_vat' ? 'PVM mokėtojas' : 'Ne PVM mokėtojas'} />
          {commission.vatMode === 'with_vat' ? (
            <>
              <InfoRow label="Suma be PVM" value={fmt(commission.amountWithoutVat)} />
              <InfoRow label="PVM suma" value={fmt(commission.vatAmount)} />
              <InfoRow label="Suma su PVM (išmoka)" value={<span className="font-bold">{fmt(commission.amountWithVat)}</span>} />
            </>
          ) : (
            <InfoRow label="Išmoka" value={<span className="font-bold">{fmt(commission.amount)}</span>} />
          )}
        </SectionCard>
      )}

      {/* D. Įmonės komisinio gavimas */}
      {!isPartnerCommission && (
        <SectionCard title="Įmonės komisinio gavimas" icon={Building}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Statusas</span>
            <Badge className={RECEIPT_STYLES[receiptStatus]}>
              {RECEIPT_LABELS[receiptStatus] || receiptStatus}
            </Badge>
          </div>
          <InfoRow label="Įmonės suma" value={fmt(companyAmount)} />
          {commission.companyCommissionReceivedAt && (
            <InfoRow label="Gauta" value={new Date(commission.companyCommissionReceivedAt).toLocaleDateString('lt-LT')} />
          )}
          {canApprove && receiptStatus !== 'fully_received' && (
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
      )}

      {/* E. Vadybininko išmoka + PAYOUT LOCK */}
      {!isPartnerCommission && (
        <SectionCard
          title="Vadybininko išmoka"
          icon={isPayoutLocked ? Lock : Banknote}
          className={isPayoutLocked ? 'border-orange-200' : ''}
        >
          {/* Payout lock warning */}
          {isPayoutLocked && (
            <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-4">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Išmoka užblokuota</p>
                <p className="text-sm text-orange-700 mt-0.5">
                  Negalima išmokėti — įmonė dar negavo viso komisinio iš kliento.
                  Pirmiausia pažymėkite, kad įmonės komisinis gautas.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Statusas</span>
            <Badge className={PAYOUT_STYLES[payoutStatus]}>
              {PAYOUT_LABELS[payoutStatus] || payoutStatus}
            </Badge>
          </div>
          {commission.managerPayoutAllowedAt && (
            <InfoRow label="Leista išmokėti" value={new Date(commission.managerPayoutAllowedAt).toLocaleDateString('lt-LT')} />
          )}
          {commission.managerPayoutPaidAt && (
            <InfoRow label="Išmokėta" value={new Date(commission.managerPayoutPaidAt).toLocaleDateString('lt-LT')} />
          )}
          {canApprove && isPayoutPayable && (
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
      )}

      {/* F. Vadybininko patvirtinimas */}
      {!isPartnerCommission && isPayoutPaid && (
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

      {/* G. Patvirtinimas / atmetimas */}
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
                <Textarea
                  placeholder="Atmetimo priežastis (nebūtina)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="h-20"
                />
                <Button variant="destructive" size="sm" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                  Patvirtinti atmetimą
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* H. Atmetimo info */}
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