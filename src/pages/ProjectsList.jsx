import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { canCreateProjects, normalizeRole } from '@/lib/constants';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Plus, FolderOpen, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  PROJECT_TYPE_LABELS, PROJECT_STAGE_LABELS,
  LIFECYCLE_LABELS, LIFECYCLE_COLORS
} from '@/lib/projectConstants';
import { getAccessibleProjectIds, filterByAccessibleProjects } from '@/lib/queryAccess';

export default function ProjectsList() {
  const context = useOutletContext() || {};
  const { user } = context;

  // Fetch accessible project IDs
  const { data: accessibleIds = null } = useQuery({
    queryKey: ['accessibleProjectIds', user?.id],
    queryFn: () => getAccessibleProjectIds(user, base44),
    enabled: !!user?.id,
  });

  // Fetch projects with access filter
  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ['projects', accessibleIds],
    queryFn: async () => {
      if (accessibleIds === null) return base44.entities.Project.list('-created_date', 50);
      return base44.entities.Project.filter({ 
        id: { $in: accessibleIds } 
      });
    },
    enabled: accessibleIds !== undefined,
  });

  const projects = allProjects;

  const canCreate = canCreateProjects(user?.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projektai</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} projekt{projects.length === 1 ? 'as' : 'ai'}
          </p>
        </div>
        {canCreate && (
          <Button asChild className="gap-2">
            <Link to="/projects/new">
              <Plus className="h-4 w-4" />
              Naujas projektas
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-card rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nėra projektų</p>
          {canCreate && (
            <Button asChild variant="outline" className="mt-4 gap-2">
              <Link to="/projects/new">
                <Plus className="h-4 w-4" /> Sukurti pirmą projektą
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/20 hover:shadow-sm transition-all duration-200 block"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{p.projectName}</p>
                  <span className="text-xs text-muted-foreground font-mono">{p.projectCode}</span>
                  <Badge variant="outline" className={cn('text-[11px] border', LIFECYCLE_COLORS[p.projectLifecycleState || 'draft'])}>
                    {LIFECYCLE_LABELS[p.projectLifecycleState || 'draft']}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {PROJECT_TYPE_LABELS[p.projectType]} · {PROJECT_STAGE_LABELS[p.projectStage]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.city}{p.district ? `, ${p.district}` : ''}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}