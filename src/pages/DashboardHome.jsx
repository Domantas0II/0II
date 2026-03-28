import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { normalizeRole } from '@/lib/constants';
import { getAccessibleProjectIds } from '@/lib/queryAccess';

import AdminDashboard from '@/components/dashboards/AdminDashboard';
import ManagerDashboard from '@/components/dashboards/ManagerDashboard';
import AgentDashboard from '@/components/dashboards/AgentDashboard';
import DeveloperDashboard from '@/components/dashboards/DeveloperDashboard';

export default function DashboardHome() {
  const context = useOutletContext() || {};
  const { user } = context;

  const normalizedRole = normalizeRole(user?.role);

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      // null = full admin access; [] = no projects; [id, ...] = filtered projects
      if (accessibleIds === null) {
        return base44.entities.Project.list('-created_date', 500);
      }
      if (accessibleIds.length === 0) {
        return [];
      }
      return base44.entities.Project.filter({ id: { $in: accessibleIds } });
    },
    enabled: accessibleIds !== undefined,
  });

  if (accessibleIds === undefined || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Kraunasi...</div>
      </div>
    );
  }

  // Route based on role
  if (normalizedRole === 'ADMINISTRATOR') {
    return <AdminDashboard projectIds={accessibleIds} projects={projects} />;
  }

  if (normalizedRole === 'SALES_MANAGER') {
    return <ManagerDashboard projectIds={accessibleIds} projects={projects} />;
  }

  if (normalizedRole === 'SALES_AGENT') {
    return <AgentDashboard projectIds={accessibleIds} />;
  }

  if (normalizedRole === 'PROJECT_DEVELOPER') {
    return <DeveloperDashboard projectIds={accessibleIds} projects={projects} />;
  }

  return <div className="text-center py-20 text-muted-foreground">Neturite prieigos prie dashboard</div>;
}