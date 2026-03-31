import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import SecondaryKPICard from '@/components/secondary/SecondaryKPICard';
import { Home, User, FileText, BarChart3, TrendingUp } from 'lucide-react';

export default function SecondaryMarketControl() {
  const { data: objects = [] } = useQuery({
    queryKey: ['secondary-objects-kpi'],
    queryFn: async () => {
      const result = await base44.entities.SecondaryObject.filter({ marketType: 'secondary' });
      return result || [];
    }
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ['secondary-buyers-kpi'],
    queryFn: async () => {
      const result = await base44.entities.SecondaryBuyerProfile.list('-created_date', 100);
      return result || [];
    }
  });

  const { data: inquiries = [] } = useQuery({
    queryKey: ['secondary-inquiries-kpi'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getSecondaryInquiries', {});
        return response.data?.inquiries || [];
      } catch {
        return [];
      }
    }
  });

  const activeObjects = objects.filter(o => o.status === 'available' || o.status === 'reserved').length;
  const newSellerLeads = inquiries.filter(i => i.inquiryType === 'seller' && i.status === 'new').length;
  const newBuyerLeads = inquiries.filter(i => i.inquiryType === 'buyer' && i.status === 'new').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">🎯 Antrinė rinka</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <SecondaryKPICard
            title="Aktyvūs objektai"
            value={activeObjects}
            icon={Home}
            color="purple"
          />
          <SecondaryKPICard
            title="Pirkėjai"
            value={buyers.filter(b => b.status === 'active').length}
            icon={User}
            color="amber"
          />
          <SecondaryKPICard
            title="Pardavimo leadai"
            value={newSellerLeads}
            icon={FileText}
            color="blue"
          />
          <SecondaryKPICard
            title="Paieškos leadai"
            value={newBuyerLeads}
            icon={TrendingUp}
            color="green"
          />
          <SecondaryKPICard
            title="Preliminarinės"
            value={(buyers.length + objects.length) * 0.2 | 0}
            icon={BarChart3}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
}