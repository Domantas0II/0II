import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDeveloperProjectStats } from '@/lib/analyticsHelpers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import KPICard from '@/components/analytics/KPICard';
import StatusChart from '@/components/analytics/StatusChart';
import { Building2, TrendingUp, Briefcase, DollarSign } from 'lucide-react';

export default function DeveloperDashboard({ projectIds, projects }) {
  const [selectedProjectId, setSelectedProjectId] = useState(projectIds?.[0] || null);

  const { data: stats } = useQuery({
    queryKey: ['developerProjectStats', [selectedProjectId]],
    queryFn: () => getDeveloperProjectStats([selectedProjectId]),
    enabled: !!selectedProjectId,
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projekto Apžvalga</h1>
        <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Pasirinkite projektą" />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project Info */}
      {selectedProject ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Projektas</p>
              <p className="text-2xl font-bold">{selectedProject.projectName}</p>
              <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                <span>{selectedProject.city}</span>
                <span>·</span>
                <span>{selectedProject.projectType}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI Cards */}
      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Laisvų objektų"
            value={stats.units.available}
            icon={TrendingUp}
            color="success"
          />
          <KPICard
            title="Rezervuotų"
            value={stats.units.reserved}
            icon={Briefcase}
            color="warning"
          />
          <KPICard
            title="Parduotų"
            value={stats.units.sold}
            icon={Building2}
            color="primary"
          />
          <KPICard
            title="Pardavimo suma"
            value={`€${(stats.soldValue || 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            color="success"
          />
          <KPICard
            title="Užklausos"
            value={stats.inquiries}
            icon={TrendingUp}
            color="primary"
          />
          <KPICard
            title="Rezervacijos"
            value={stats.reservations}
            icon={Briefcase}
            color="primary"
          />
          <KPICard
            title="Susitarimai"
            value={stats.deals}
            icon={TrendingUp}
            color="success"
          />
        </div>
      ) : null}

      {/* Units Distribution */}
      {stats ? (
        <StatusChart
          data={[
            { name: 'Laisvai', value: stats.units.available },
            { name: 'Rezervuota', value: stats.units.reserved },
            { name: 'Parduota', value: stats.units.sold }
          ]}
          title="Objektų Paskirstymas"
        />
      ) : null}
    </div>
  );
}