import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getAccessibleProjectIds } from '@/lib/queryAccess';
import { getAgentPerformance } from '@/lib/analyticsHelpers';
import { normalizeRole } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TeamPerformance() {
  const context = useOutletContext() || {};
  const { user } = context;
  const normalizedRole = normalizeRole(user?.role);

  // Only ADMIN and SALES_MANAGER can access
  if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(normalizedRole)) {
    return <div className="text-center py-20 text-muted-foreground">Neturite prieigos</div>;
  }

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  // Fetch all users (for agent list)
  // Limited to 100 users for performance. In large teams, this should be paginated.
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 100),
  });

  // Filter to agents/managers only
  const agentIds = users
    .filter(u => ['SALES_AGENT', 'SALES_MANAGER'].includes(normalizeRole(u.role)))
    .map(u => u.id);

  // Get agent performance
  const { data: agentPerformance, isLoading } = useQuery({
    queryKey: ['agentPerformance', accessibleIds, agentIds],
    queryFn: () => getAgentPerformance(accessibleIds, agentIds),
    enabled: accessibleIds !== undefined && agentIds.length > 0,
  });

  // Sort by sold value
  const sortedAgents = agentPerformance?.sort((a, b) => b.soldValue - a.soldValue) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild size="sm">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Komandos Veiklos Palyginimas</h1>
      </div>

      {/* Performance Table */}
      {isLoading ? (
        <div className="text-muted-foreground">Kraunasi...</div>
      ) : sortedAgents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            Nėra duomenų
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agentų Efektyvumas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-2 font-medium text-muted-foreground">Agentas</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Suinteresuoti</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Rezervacijos</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Susitarimai</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Suma</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map(agent => {
                    const agentUser = users.find(u => u.id === agent.userId);
                    return (
                      <tr key={agent.userId} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <span className="font-medium">{agentUser?.full_name || agent.userId}</span>
                        </td>
                        <td className="text-right p-2">{agent.interests}</td>
                        <td className="text-right p-2">{agent.reservations}</td>
                        <td className="text-right p-2">
                          <Badge variant={agent.deals > 0 ? 'default' : 'outline'}>
                            {agent.deals}
                          </Badge>
                        </td>
                        <td className="text-right p-2 font-medium">
                          €{agent.soldValue.toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {sortedAgents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Santrauka</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Iš viso agentų:</span>
              <span className="font-medium">{sortedAgents.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Iš viso suinteresuotų:</span>
              <span className="font-medium">{sortedAgents.reduce((sum, a) => sum + a.interests, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Iš viso susitarimų:</span>
              <span className="font-medium">{sortedAgents.reduce((sum, a) => sum + a.deals, 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Bendra pardavimų suma:</span>
              <span className="font-bold">
                €{sortedAgents.reduce((sum, a) => sum + a.soldValue, 0).toLocaleString('lt-LT', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}