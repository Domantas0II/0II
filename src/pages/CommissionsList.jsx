import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const STATUS_STYLES   = { pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-blue-100 text-blue-800', rejected: 'bg-red-100 text-red-800', paid: 'bg-green-100 text-green-800' };
const STATUS_LABELS   = { pending: 'Laukia', approved: 'Patvirtinta', rejected: 'Atmesta', paid: 'Išmokėta' };
const RECEIPT_STYLES  = { not_received: 'bg-gray-100 text-gray-700', partially_received: 'bg-yellow-100 text-yellow-800', fully_received: 'bg-green-100 text-green-800' };
const RECEIPT_LABELS  = { not_received: 'Negauta', partially_received: 'Dalinai', fully_received: 'Gauta' };
const PAYOUT_STYLES   = { not_payable_yet: 'bg-gray-100 text-gray-700', payable: 'bg-blue-100 text-blue-800', paid: 'bg-green-100 text-green-800' };
const PAYOUT_LABELS   = { not_payable_yet: 'Dar neleid.', payable: 'Galima', paid: 'Išmokėta' };

export default function CommissionsList() {
  const [statusFilter, setStatusFilter]   = useState('all');
  const [receiptFilter, setReceiptFilter] = useState('all');
  const [payoutFilter, setPayoutFilter]   = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const role = normalizeRole(currentUser?.role);
  const isAgent = role === 'SALES_AGENT';
  const canManage = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', currentUser?.id],
    queryFn: async () => {
      const filter = {};
      if (isAgent) filter.userId = currentUser.id;
      return base44.entities.Commission.filter(filter, '-calculatedAt', 200);
    },
    enabled: !!currentUser
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-map'],
    queryFn: () => base44.entities.Project.list('-created_date', 200)
  });
  const projectsMap = Object.fromEntries((projects || []).map(p => [p.id, p]));

  const filtered = commissions.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (receiptFilter !== 'all' && c.companyCommissionReceiptStatus !== receiptFilter) return false;
    if (payoutFilter !== 'all' && c.managerPayoutStatus !== payoutFilter) return false;
    if (projectFilter !== 'all' && c.projectId !== projectFilter) return false;
    return true;
  });

  // SOURCE-OF-TRUTH: Commission.amount = šio gavėjo komisinio suma po split
  // Commission.amountWithVat = suma su PVM (jei vatMode = 'with_vat')
  const totals = {
    pending: commissions.filter(c => c.status === 'pending')
      .reduce((s, c) => s + (c.amount || 0), 0),
    payable: commissions.filter(c => c.managerPayoutStatus === 'payable')
      .reduce((s, c) => s + (c.amountWithVat || c.amount || 0), 0),
    paid:    commissions.filter(c => c.managerPayoutStatus === 'paid')
      .reduce((s, c) => s + (c.amountWithVat || c.amount || 0), 0),
  };

  const fmt = (n) => `€${Number(n || 0).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Komisiniai</h1>
        {canManage && (
          <Link to="/payouts"><Button variant="outline">Išmokų sąrašas</Button></Link>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Laukia patvirtinimo', val: totals.pending, color: 'text-yellow-600' },
          { label: 'Galima išmokėti', val: totals.payable, color: 'text-blue-600' },
          { label: 'Išmokėta vadybininkams', val: totals.paid, color: 'text-green-600' }
        ].map(({ label, val, color }) => (
          <Card key={label}><CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{fmt(val)}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Statusas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="pending">Laukia</SelectItem>
            <SelectItem value="approved">Patvirtinta</SelectItem>
            <SelectItem value="rejected">Atmesta</SelectItem>
            <SelectItem value="paid">Išmokėta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={receiptFilter} onValueChange={setReceiptFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Įm. gavimas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi gavimo stat.</SelectItem>
            <SelectItem value="not_received">Negauta</SelectItem>
            <SelectItem value="partially_received">Dalinai</SelectItem>
            <SelectItem value="fully_received">Gauta visiškai</SelectItem>
          </SelectContent>
        </Select>
        <Select value={payoutFilter} onValueChange={setPayoutFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Vadyb. išmoka" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi išmokos stat.</SelectItem>
            <SelectItem value="not_payable_yet">Dar neleidžiama</SelectItem>
            <SelectItem value="payable">Galima</SelectItem>
            <SelectItem value="paid">Išmokėta</SelectItem>
          </SelectContent>
        </Select>
        {!isAgent && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Projektas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Visi projektai</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-sm text-muted-foreground self-center">
          {filtered.length === 1 ? '1 įrašas' : filtered.length >= 2 && filtered.length <= 9 ? `${filtered.length} įrašai` : `${filtered.length} įrašų`}
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-12 pb-12 text-center text-muted-foreground">Komisinių nerasta</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const proj = projectsMap[c.projectId];
            // Commission.vatMode drives display; amount / amountWithVat are the canonical fields
            const managerFmt = c.vatMode === 'with_vat'
              ? fmt(c.amountWithVat)
              : fmt(c.amount);
            return (
              <Link key={c.id} to={`/commissions/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge className={STATUS_STYLES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {proj ? proj.projectName : `Deal #${c.dealId?.slice(-6)}`}
                        </p>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{new Date(c.calculatedAt).toLocaleDateString('lt-LT')}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">Bazė: {fmt(c.saleBaseAmount)}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">Bendras: {fmt(c.totalCommission)}</span>
                          {c.vatMode && (
                            <Badge variant="outline" className="text-xs py-0">{c.vatMode === 'with_vat' ? 'PVM' : 'be PVM'}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col gap-1">
                        <Badge className={RECEIPT_STYLES[c.companyCommissionReceiptStatus || 'not_received']}>
                          Įm: {RECEIPT_LABELS[c.companyCommissionReceiptStatus || 'not_received']}
                        </Badge>
                        <Badge className={PAYOUT_STYLES[c.managerPayoutStatus || 'not_payable_yet']}>
                          Vad: {PAYOUT_LABELS[c.managerPayoutStatus || 'not_payable_yet']}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{managerFmt}</p>
                        <p className="text-xs text-muted-foreground">vadyb.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}