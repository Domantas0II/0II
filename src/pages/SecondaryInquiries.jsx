import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Phone, User, Home, ArrowRight } from 'lucide-react';
import { logError } from '@/lib/logger';

export default function SecondaryInquiries() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('seller');
  const [showConvert, setShowConvert] = useState(null);
  const [convertForm, setConvertForm] = useState({});

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['secondary-inquiries'],
    queryFn: () => base44.functions.invoke('getSecondaryInquiries', {}).then(r => r.data)
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => base44.entities.Client.list('-created_date', 100)
  });

  const takeLeadMutation = useMutation({
    mutationFn: (inquiryId) => base44.functions.invoke('takeSecondaryLead', { inquiryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secondary-inquiries'] });
      toast.success('Lead perimtas');
    },
    onError: (error) => {
      logError(error, { action: 'takeSecondaryLead' });
      toast.error('Neišeina perimti lead');
    }
  });

  const convertSellerMutation = useMutation({
    mutationFn: () => base44.functions.invoke('convertSellerLead', {
      inquiryId: showConvert,
      clientId: convertForm.clientId,
      assignedAgentUserId: currentUser?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secondary-inquiries'] });
      toast.success('Konvertuota į SecondaryObject');
      setShowConvert(null);
    },
    onError: (error) => {
      logError(error, { action: 'convertSellerLead' });
      toast.error('Konversija nepavyko');
    }
  });

  const convertBuyerMutation = useMutation({
    mutationFn: () => base44.functions.invoke('convertBuyerLead', {
      inquiryId: showConvert,
      clientId: convertForm.clientId,
      assignedAgentUserId: currentUser?.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secondary-inquiries'] });
      toast.success('Konvertuota į SecondaryBuyerProfile');
      setShowConvert(null);
    },
    onError: (error) => {
      logError(error, { action: 'convertBuyerLead' });
      toast.error('Konversija nepavyko');
    }
  });

  const sellerLeads = inquiries.filter(i => i.inquiryType === 'seller');
  const buyerLeads = inquiries.filter(i => i.inquiryType === 'buyer');

  const handleConvertClick = (inquiry, type) => {
    setShowConvert(inquiry.id);
    setConvertForm({ inquiryType: type, clientId: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Secondary Leads</h1>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="seller" className="gap-2">
            <Home className="h-4 w-4" /> Pardavimo Leadai ({sellerLeads.length})
          </TabsTrigger>
          <TabsTrigger value="buyer" className="gap-2">
            <User className="h-4 w-4" /> Paieškos Leadai ({buyerLeads.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seller" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-secondary animate-pulse rounded-lg" />)}
            </div>
          ) : sellerLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nėra pardavimo leadų
              </CardContent>
            </Card>
          ) : (
            sellerLeads.map(lead => (
              <Card key={lead.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{lead.fullName}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone} • {lead.email}</p>
                      <p className="text-sm mt-2">{lead.propertyAddress}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lead.propertyType} • {lead.estimatedPrice ? `~€${lead.estimatedPrice}` : 'Nėra kainos'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          const tel = `tel:${lead.phone}`;
                          window.location.href = tel;
                        }}
                      >
                        <Phone className="h-3.5 w-3.5" /> Skambinti
                      </Button>
                      {!lead.assignedAgentUserId && (
                        <Button
                          size="sm"
                          onClick={() => takeLeadMutation.mutate(lead.id)}
                          disabled={takeLeadMutation.isPending}
                        >
                          Perimti
                        </Button>
                      )}
                      {lead.assignedAgentUserId === currentUser?.id && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => handleConvertClick(lead, 'seller')}
                        >
                          <ArrowRight className="h-3.5 w-3.5" /> Konvertuoti
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="buyer" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-secondary animate-pulse rounded-lg" />)}
            </div>
          ) : buyerLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nėra paieškos leadų
              </CardContent>
            </Card>
          ) : (
            buyerLeads.map(lead => (
              <Card key={lead.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{lead.fullName}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone} • {lead.email}</p>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {lead.preferredCity && <Badge variant="outline" className="text-xs">{lead.preferredCity}</Badge>}
                        {lead.preferredPropertyType && <Badge variant="outline" className="text-xs">{lead.preferredPropertyType}</Badge>}
                        {lead.budgetMin && <Badge variant="outline" className="text-xs">€{lead.budgetMin}-{lead.budgetMax}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          const tel = `tel:${lead.phone}`;
                          window.location.href = tel;
                        }}
                      >
                        <Phone className="h-3.5 w-3.5" /> Skambinti
                      </Button>
                      {!lead.assignedAgentUserId && (
                        <Button
                          size="sm"
                          onClick={() => takeLeadMutation.mutate(lead.id)}
                          disabled={takeLeadMutation.isPending}
                        >
                          Perimti
                        </Button>
                      )}
                      {lead.assignedAgentUserId === currentUser?.id && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => handleConvertClick(lead, 'buyer')}
                        >
                          <ArrowRight className="h-3.5 w-3.5" /> Konvertuoti
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Convert Dialog */}
      <Dialog open={!!showConvert} onOpenChange={() => setShowConvert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {convertForm.inquiryType === 'seller' ? 'Konvertuoti į SecondaryObject' : 'Konvertuoti į SecondaryBuyerProfile'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Kliento pasirinkimas</label>
              <Select value={convertForm.clientId || ''} onValueChange={(v) => setConvertForm(f => ({ ...f, clientId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pasirinkti klientą..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(null)}>Atšaukti</Button>
            <Button
              onClick={() => {
                if (convertForm.inquiryType === 'seller') {
                  convertSellerMutation.mutate();
                } else {
                  convertBuyerMutation.mutate();
                }
              }}
              disabled={!convertForm.clientId}
            >
              Konvertuoti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}