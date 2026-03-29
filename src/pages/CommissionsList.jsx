import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ChevronRight } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  paid:     'bg-green-100 text-green-800'
};

const STATUS_LABELS = {
  pending: 'Laukia', approved: 'Patvirtinta', rejected: 'Atmesta', paid: 'Išmokėta'
};

export default function CommissionsList() {
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me()
  });

  const role = normalizeRole(currentUser?.role);
  const isAgent = role === 'SALES_AGENT';

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', statusFilter, currentUser?.id],
    queryFn: async () => {
      const filter = {};
      if (statusFilter !== 'all') filter.status = statusFilter;
      if (isAgent) filter.userId = currentUser.id;
      return base44.entities.Commission.filter(filter, '-calculatedAt', 100);
    },
    enabled: !!currentUser
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals-map'],
    queryFn: () => base44.entities.Deal.list('-created_date', 200)
  });

  const dealsMap = Object.fromEntries((deals || []).map(d => [d.id, d]));

  const totals = {
    pending:  commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0),
    approved: commissions.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount, 0),
    paid:     commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Komisiniai</h1>
        {!isAgent && (
          <Link to="/payouts">
            <Button variant="outline">Payout sąrašas</Button>
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Laukia patvirtinimo', key: 'pending', color: 'text-yellow-600' },
          { label: 'Patvirtinta', key: 'approved', color: 'text-blue-600' },
          { label: 'Išmokėta', key: 'paid', color: 'text-green-600' }
        ].map(({ label, key, color }) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>€{totals[key].toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Visi statusai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="pending">Laukia</SelectItem>
            <SelectItem value="approved">Patvirtinta</SelectItem>
            <SelectItem value="rejected">Atmesta</SelectItem>
            <SelectItem value="paid">Išmokėta</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{commissions.length} įrašai</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : commissions.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            Komisinių nerasta
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {commissions.map(c => {
            const deal = dealsMap[c.dealId];
            return (
              <Link key={c.id} to={`/commissions/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge className={STATUS_STYLES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                      <div>
                        <p className="font-medium text-sm">Deal #{c.dealId?.slice(-6)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.calculatedAt).toLocaleDateString('lt-LT')}
                          {deal && ` · €${deal.totalAmount?.toLocaleString('lt-LT')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">€{c.amount?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-muted-foreground">be PVM: €{c.amountWithoutVat?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
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