import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { normalizeRole } from '@/lib/constants';
import { TrendingUp, AlertTriangle, Clock, Target } from 'lucide-react';

export default function ManagerInsights() {
  const { user } = useOutletContext();
  const role = normalizeRole(user?.role);
  const [selectedProject, setSelectedProject] = useState('');

  const canView = role === 'ADMINISTRATOR' || role === 'SALES_MANAGER';

  const { data: projectsList = [] } = useQuery({
    queryKey: ['projects', user?.id, role],
    queryFn: async () => {
      if (role === 'ADMINISTRATOR') {
        return await base44.entities.Project.list('-created_date', 50);
      } else {
        const assignments = await base44.entities.UserProjectAssignment.filter({
          userId: user.id,
          removedAt: null
        });
        if (!assignments?.length) return [];
        const projectIds = assignments.map(a => a.projectId);
        const projects = [];
        for (const id of projectIds) {
          const result = await base44.entities.Project.filter({ id });
          if (result?.[0]) projects.push(result[0]);
        }
        return projects;
      }
    },
    enabled: !!user?.id
  });

  const { data: insights = {} } = useQuery({
    queryKey: ['managerInsights', selectedProject],
    queryFn: async () => {
      if (!selectedProject) return {};

      const projectIds = [selectedProject];

      // Fetch high-score critical items
      const criticalScores = await base44.entities.LeadScore.filter({
        projectId: selectedProject,
        band: 'critical'
      });

      // Fetch recent deals
      const deals = await base44.entities.Deal.filter({
        projectId: selectedProject
      });

      // Fetch reservations at risk (expiring soon)
      const reservations = await base44.entities.Reservation.filter({
        projectId: selectedProject,
        status: 'active'
      });

      const atRisk = reservations?.filter(r => {
        const daysLeft = (new Date(r.expiresAt) - new Date()) / (1000 * 60 * 60 * 24);
        return daysLeft < 7;
      }) || [];

      return {
        criticalLeads: criticalScores?.slice(0, 5) || [],
        recentDeals: deals?.slice(0, 5) || [],
        atRiskReservations: atRisk
      };
    },
    enabled: !!selectedProject && canView
  });

  if (!canView) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Šiam puslapiui reikalingas vadybininko arba administratoriaus statusas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vadybininko Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Aukšto lygio komandos ir projekto metrikos</p>
      </div>

      {/* Project selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pasirinkite projektą</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {projectsList.map(proj => (
              <Button
                key={proj.id}
                variant={selectedProject === proj.id ? 'default' : 'outline'}
                onClick={() => setSelectedProject(proj.id)}
                className="justify-start text-left"
              >
                <div>
                  <p className="font-medium text-sm">{proj.projectName}</p>
                  <p className="text-xs text-muted-foreground">{proj.projectCode}</p>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedProject && (
        <>
          {/* Critical leads */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" /> Kritiniai Leadai
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insights.criticalLeads?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nėra kritinių leadų</p>
              ) : (
                <div className="space-y-2">
                  {insights.criticalLeads?.map(lead => (
                    <div key={lead.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{lead.scoreType}</p>
                          <p className="text-xs text-muted-foreground">{lead.recommendationText}</p>
                        </div>
                        <Badge className="bg-red-600">Score: {lead.scoreValue}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* At-risk reservations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" /> Rizikos Rezervacijos (baigiasi per 7 d.)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insights.atRiskReservations?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Jokios rizikos</p>
              ) : (
                <div className="space-y-2">
                  {insights.atRiskReservations?.map(res => {
                    const daysLeft = Math.ceil((new Date(res.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={res.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium">Baigiasi per {daysLeft} dienų</p>
                          <Badge variant="outline">ID: {res.id?.slice(-6)}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent deals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" /> Pastaruose Dealai
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insights.recentDeals?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nėra dealų</p>
              ) : (
                <div className="space-y-2">
                  {insights.recentDeals?.map(deal => (
                    <div key={deal.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">€{deal.totalAmount?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{deal.soldAt?.split('T')[0]}</p>
                        </div>
                        <Badge className="bg-green-600">Deal</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}