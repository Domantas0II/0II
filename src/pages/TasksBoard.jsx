import React from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeRole } from '@/lib/constants';

const COLUMNS = [
  { id: 'pending', label: 'Laukiančios', color: 'bg-blue-50 border-blue-200' },
  { id: 'in_progress', label: 'Vykdomos', color: 'bg-amber-50 border-amber-200' },
  { id: 'overdue', label: 'Vėluojančios', color: 'bg-red-50 border-red-200' },
  { id: 'completed', label: 'Baigtos', color: 'bg-green-50 border-green-200' }
];

const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
};

function TaskCard({ task, onStatusChange }) {
  const now = new Date();
  const due = new Date(task.dueAt);
  const hoursLeft = Math.floor((due - now) / 3600000);
  const minutesLeft = Math.floor(((due - now) % 3600000) / 60000);

  const isOverdue = task.status === 'overdue' || (due < now && task.status !== 'completed');

  return (
    <div className={cn(
      'p-3 border rounded-lg cursor-move hover:shadow-md transition',
      isOverdue ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-xs flex-1 line-clamp-2">{task.title}</h4>
        {task.escalationLevel > 0 && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
            task.escalationLevel === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          )}>
            <Zap className="h-2.5 w-2.5" />
            L{task.escalationLevel}
          </div>
        )}
      </div>

      <div className="space-y-1 mb-2 text-xs">
        <Badge className={PRIORITY_COLORS[task.priority]}>
          {task.priority}
        </Badge>

        <div className={cn(
          'flex items-center gap-1 p-1 rounded',
          isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        )}>
          <Clock className="h-2.5 w-2.5" />
          {isOverdue
            ? `${Math.abs(hoursLeft)}h ${Math.abs(minutesLeft)}m vėluoja`
            : hoursLeft > 0
            ? `${hoursLeft}h ${minutesLeft}m likutis`
            : `${minutesLeft}m likutis`
          }
        </div>
      </div>

      <div className="flex gap-1">
        {task.status === 'pending' && (
          <Button
            size="xs"
            variant="outline"
            className="flex-1 h-6 text-xs"
            onClick={() => onStatusChange(task.id, 'in_progress')}
          >
            Pradėti
          </Button>
        )}
        {task.status === 'in_progress' && (
          <Button
            size="xs"
            variant="outline"
            className="flex-1 h-6 text-xs text-green-600"
            onClick={() => onStatusChange(task.id, 'completed')}
          >
            Baigti
          </Button>
        )}
      </div>
    </div>
  );
}

export default function TasksBoard() {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const role = normalizeRole(user?.role);

  const projectId = searchParams.get('projectId');

  // Access control
  const canView = role === 'SALES_MANAGER' || role === 'ADMINISTRATOR';

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-board', user?.id, role],
    queryFn: async () => {
      if (role === 'ADMINISTRATOR') {
        return await base44.entities.Project.list('-created_date', 50);
      } else {
        const assignments = await base44.entities.UserProjectAssignment.filter({
          userId: user.id,
          removedAt: null
        });
        if (!assignments || assignments.length === 0) return [];
        const projectIds = assignments.map(a => a.projectId);
        const projects = [];
        for (const id of projectIds) {
          const result = await base44.entities.Project.filter({ id });
          if (result?.[0]) projects.push(result[0]);
        }
        return projects.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      }
    },
    enabled: !!user?.id
  });

  const selectedProjectId = projectId || projects[0]?.id;

  // Fetch tasks for selected project
  const { data: tasks = [] } = useQuery({
    queryKey: ['board-tasks', selectedProjectId],
    queryFn: async () => {
      const response = await base44.functions.invoke('getTasks', {
        projectId: selectedProjectId
      });
      return response.data?.tasks || [];
    },
    enabled: !!selectedProjectId
  });

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await base44.functions.invoke('updateTaskStatus', {
        taskId,
        newStatus
      });
      location.reload();
    } catch (err) {
      console.error('Failed to update:', err);
    }
  };

  // Group tasks by status
  const tasksByStatus = {};
  COLUMNS.forEach(col => {
    tasksByStatus[col.id] = tasks.filter(t => t.status === col.id);
  });

  if (!canView) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Tik vadybininkai ir administratoriai gali naudoti Kanban lentą
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Užduočių Kanban</h1>
        <p className="text-sm text-muted-foreground mt-1">Vadinkite projekto užduotis pagal statusą</p>
      </div>

      {/* Project selector */}
      <Select value={selectedProjectId || ''} onValueChange={(id) => {
        const url = new URL(window.location);
        url.searchParams.set('projectId', id);
        window.location.href = url.toString();
      }}>
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {projects.map(proj => (
            <SelectItem key={proj.id} value={proj.id}>
              {proj.projectName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {COLUMNS.map(column => (
          <div key={column.id} className={cn('border rounded-lg p-4', column.color)}>
            <h3 className="font-semibold text-sm mb-4 flex items-center justify-between">
              {column.label}
              <span className="bg-white px-2 py-0.5 rounded text-xs text-gray-600">
                {tasksByStatus[column.id].length}
              </span>
            </h3>

            <div className="space-y-3">
              {tasksByStatus[column.id].map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {tasksByStatus[column.id].length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  Nėra užduočių
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}