import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  getProjectKpis,
  getInquiryFunnel,
  getPipelineBreakdown,
  getDealStats
} from '@/lib/analyticsHelpers';
import { Button } from '@/components/ui/button';

import KPICard from '@/components/analytics/KPICard';
import FunnelChart from '@/components/analytics/FunnelChart';
import StatusChart from '@/components/analytics/StatusChart';
import { ArrowLeft, Building2, TrendingUp, Briefcase, DollarSign } from 'lucide-react';

export default function ProjectAnalytics() {
  const { id: projectId } = useParams();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }).then(p => p?.[0]),
    enabled: !!projectId,
  });

  const { data: kpis } = useQuery({
    queryKey: ['projectKpis', [projectId]],
    queryFn: () => getProjectKpis([projectId]),
    enabled: !!projectId,
  });

  const { data: funnel } = useQuery({
    queryKey: ['inquiryFunnel', [projectId]],
    queryFn: () => getInquiryFunnel([projectId]),
    enabled: !!projectId,
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipelineBreakdown', [projectId]],
    queryFn: () => getPipelineBreakdown([projectId]),
    enabled: !!projectId,
  });

  const { data: dealStats } = useQuery({
    queryKey: ['dealStats', [projectId]],
    queryFn: () => getDealStats([projectId]),
    enabled: !!projectId,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild size="sm">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">{project?.projectName}</h1>
      </div>

      {/* KPI Cards */}
      {kpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Laisvų objektų"
            value={kpis.unitStats.available}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Rezervuotų"
            value={kpis.unitStats.reserved}
            icon={Briefcase}
            color="warning"
          />
          <KPICard
            title="Parduotų"
            value={kpis.unitStats.sold}
            icon={Building2}
            color="primary"
          />
          <KPICard
            title="Pardavimo suma"
            value={`€${(dealStats?.soldValue || 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            color="success"
          />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {funnel && <FunnelChart data={funnel} title="Užklausų Litvai" />}
        {pipeline && <FunnelChart data={pipeline} title="Pipeline Stadijos" />}
      </div>

      {/* Units Distribution */}
      {kpis && (
        <StatusChart
          data={[
            { name: 'Laisvai', value: kpis.unitStats.available },
            { name: 'Rezervuota', value: kpis.unitStats.reserved },
            { name: 'Parduota', value: kpis.unitStats.sold }
          ]}
          title="Objektų Paskirstymas"
        />
      )}
    </div>
  );
}