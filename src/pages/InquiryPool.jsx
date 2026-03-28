import React, { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Phone, Mail, Clock, User, ArrowRight, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { canAccessInbound, normalizeRole } from '@/lib/constants';
import { getAccessibleProjectIds, filterByAccessibleProjects } from '@/lib/queryAccess';
import { validateProjectInquiry, findDuplicateClient } from '@/lib/inquiryValidation';
import { format } from 'date-fns';

const STATUS_LABELS = {
  new: 'Naujas',
  claimed: 'Suėmtas',
  contacted: 'Susisiekta',
  converted: 'Konvertuotas',
  rejected: 'Atmestas',
  duplicate: 'Dublikatas',
};

const STATUS_COLORS = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  claimed: 'bg-purple-50 text-purple-700 border-purple-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  converted: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  duplicate: 'bg-gray-50 text-gray-700 border-gray-200',
};

export default function InquiryPool() {
  const context = useOutletContext() || {};
  const { user } = context;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', project: 'all', status: 'all', claimed: 'all' });
  const [duplicateDialog, setDuplicateDialog] = useState(null);

  const canAccess = canAccessInbound(normalizeRole(user?.role));
  if (!canAccess) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos prie šio modulio</div>;
  }

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.Project.list('-created_date');
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['inquiries', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.ProjectInquiry.list('-created_date');
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', accessibleIds],
    queryFn: async () => {
      const all = await base44.entities.SaleUnit.list();
      return filterByAccessibleProjects(all, accessibleIds);
    },
    enabled: accessibleIds !== undefined,
  });

  const claimInquiry = useMutation({
    mutationFn: (inquiryId) =>
      base44.entities.ProjectInquiry.update(inquiryId, {
        status: 'claimed',
        claimedByUserId: user?.id,
        claimedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      toast.success('Inquiry suėmtas');
    },
  });

  const convertInquiry = useMutation({
    mutationFn: async (inquiry, useExistingClient = false, existingClientId = null) => {
      // 0. Validate inquiry data
      try {
        await validateProjectInquiry(inquiry);
      } catch (e) {
        throw new Error(e.message);
      }

      // 0.5. Check access to project
      if (!accessibleIds.includes(inquiry.projectId)) {
        throw new Error('Neturite prieigos prie šio projekto');
      }

      // 1. Find or create Client
      let clientId = existingClientId;
      if (!useExistingClient) {
        const client = await base44.entities.Client.create({
          fullName: inquiry.fullName,
          phone: inquiry.phone,
          email: inquiry.email,
          createdByUserId: user?.id,
        });
        clientId = client.id;
      }

      // 2. Create ClientProjectInterest
      await base44.entities.ClientProjectInterest.create({
        projectId: inquiry.projectId,
        clientId,
        assignedManagerUserId: user?.id,
        status: 'new_interest',
      });

      // 3. Create ClientUnitInterest if unitId exists
      if (inquiry.unitId) {
        await base44.entities.ClientUnitInterest.create({
          projectId: inquiry.projectId,
          clientId,
          unitId: inquiry.unitId,
          priorityOrder: 1,
        });
      }

      // 4. Update inquiry
      await base44.entities.ProjectInquiry.update(inquiry.id, {
        status: 'converted',
        convertedClientId: clientId,
      });

      return clientId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
      setDuplicateDialog(null);
      toast.success('Konvertuota į kliento');
    },
    onError: (error) => {
      toast.error(error.message || 'Konversija nepavyko');
    },
  });

  const handleConvertClick = async (inquiry) => {
    // Check for duplicate
    const duplicate = await findDuplicateClient(inquiry.phone, inquiry.email);
    if (duplicate) {
      setDuplicateDialog({ inquiry, duplicate });
    } else {
      convertInquiry.mutate(inquiry);
    }
  };

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));

  const filtered = inquiries.filter(i => {
    if (filters.search && !i.fullName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.project !== 'all' && i.projectId !== filters.project) return false;
    if (filters.status !== 'all' && i.status !== filters.status) return false;
    if (filters.claimed === 'claimed' && !i.claimedByUserId) return false;
    if (filters.claimed === 'unclaimed' && i.claimedByUserId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Užklausų baseinas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} užklausa</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ieškoti pagal vardą..."
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
            <SelectValue placeholder="Statumas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi statusai</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.claimed} onValueChange={v => setFilters(prev => ({ ...prev, claimed: v }))}>
          <SelectTrigger className="w-full sm:w-[140px] bg-card">
            <SelectValue placeholder="Suėmimas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi</SelectItem>
            <SelectItem value="claimed">Suėmti</SelectItem>
            <SelectItem value="unclaimed">Nesuėmti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-card rounded-lg border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nėra užklausų</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inquiry => (
            <div key={inquiry.id} className="flex items-center gap-3 p-4 bg-card rounded-lg border hover:border-primary/20 transition-all">
              {/* Left side: Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{inquiry.fullName}</p>
                  <Badge variant="outline" className={`text-[11px] border ${STATUS_COLORS[inquiry.status] || ''}`}>
                    {STATUS_LABELS[inquiry.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-0.5">
                  {inquiry.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {inquiry.phone}</span>}
                  {inquiry.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {inquiry.email}</span>}
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(inquiry.created_date), 'MM-dd HH:mm')}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1">
                  <span>{projectMap[inquiry.projectId]?.projectName || inquiry.projectId}</span>
                  {inquiry.unitId && <span>· {unitMap[inquiry.unitId]?.label || inquiry.unitId}</span>}
                  {inquiry.claimedByUserId && <span className="flex items-center gap-1"><User className="h-3 w-3" /> Suėmtas</span>}
                </div>
              </div>

              {/* Right side: Actions */}
              <div className="flex gap-2 flex-shrink-0">
                {!inquiry.claimedByUserId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => claimInquiry.mutate(inquiry.id)}
                    disabled={claimInquiry.isPending}
                  >
                    Suėmti
                  </Button>
                )}
                {(inquiry.claimedByUserId === user?.id || inquiry.status === 'claimed') && inquiry.status !== 'converted' && (
                  <Button
                    size="sm"
                    onClick={() => handleConvertClick(inquiry)}
                    disabled={convertInquiry.isPending}
                    className="gap-2"
                  >
                    <ArrowRight className="h-3.5 w-3.5" /> Konvertuoti
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicateDialog} onOpenChange={() => setDuplicateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dublikatinis klientas</DialogTitle>
          </DialogHeader>
          {duplicateDialog && (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-700">
                  Jau egzistuoja klientas su šiuo telefonu arba el. paštu
                </AlertDescription>
              </Alert>
              <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{duplicateDialog.duplicate.fullName}</p>
                {duplicateDialog.duplicate.phone && <p className="text-xs text-muted-foreground">{duplicateDialog.duplicate.phone}</p>}
                {duplicateDialog.duplicate.email && <p className="text-xs text-muted-foreground">{duplicateDialog.duplicate.email}</p>}
              </div>
              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={() => convertInquiry.mutate(duplicateDialog.inquiry, true, duplicateDialog.duplicate.id)}
                  disabled={convertInquiry.isPending}
                >
                  Naudoti esamą
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => convertInquiry.mutate(duplicateDialog.inquiry, false)}
                  disabled={convertInquiry.isPending}
                >
                  Kurti naują
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}