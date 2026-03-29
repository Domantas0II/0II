import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, ChevronRight } from 'lucide-react';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

const STATUS_STYLES = {
  draft:    'bg-secondary text-secondary-foreground',
  approved: 'bg-blue-100 text-blue-800',
  paid:     'bg-green-100 text-green-800'
};
const STATUS_LABELS = { draft: 'Juodraštis', approved: 'Patvirtinta', paid: 'Išmokėta' };

export default function PayoutsList() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ userId: '', periodStart: '', periodEnd: '' });

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const role = normalizeRole(currentUser?.role);
  const canManage = ['ADMINISTRATOR', 'SALES_MANAGER'].includes(role);

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['payouts'],
    queryFn: () => base44.entities.Payout.list('-created_date', 100)
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
    enabled: canManage
  });

  const createMutation = useMutation({
    mutationFn: () => base44.functions.invoke('createPayout', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      toast.success('Payout sukurtas');
      setShowCreate(false);
      setForm({ userId: '', periodStart: '', periodEnd: '' });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Klaida')
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Payout sąrašas</h1>
        {canManage && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Naujas Payout
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : payouts.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            Payout nerasta
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payouts.map(p => (
            <Link key={p.id} to={`/payouts/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge className={STATUS_STYLES[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    <div>
                      <p className="font-medium text-sm">{p.userName || p.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.periodStart} – {p.periodEnd} · {p.itemCount} komisiniai
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold">€{p.totalAmount?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-muted-foreground">be PVM: €{p.totalWithoutVat?.toLocaleString('lt-LT', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Payout Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Naujas Payout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Gavėjas</label>
              <Select value={form.userId} onValueChange={(v) => setForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pasirinkti vartotoją..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Periodo pradžia</label>
                <Input type="date" value={form.periodStart} onChange={(e) => setForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Periodo pabaiga</label>
                <Input type="date" value={form.periodEnd} onChange={(e) => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Atšaukti</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.userId || !form.periodStart || !form.periodEnd || createMutation.isPending}
            >
              Sukurti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}