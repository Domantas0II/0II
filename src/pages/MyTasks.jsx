import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';


const STATUS_COLORS = {
  pending: 'bg-blue-50 border-blue-200',
  in_progress: 'bg-amber-50 border-amber-200',
  overdue: 'bg-red-50 border-red-200',
  completed: 'bg-green-50 border-green-200',
  cancelled: 'bg-gray-50 border-gray-200'
};

const PRIORITY_COLORS = {
  low: 'text-gray-600 bg-gray-100',
  medium: 'text-blue-600 bg-blue-100',
  high: 'text-orange-600 bg-orange-100',
  critical: 'text-red-600 bg-red-100'
};

const TYPE_LABELS = {
  follow_up: '📞 Follow-up',
  call: '☎️ Skambutis',
  meeting: '🤝 Susitikimas',
  document: '📄 Dokumentas',
  reservation_expiry: '⏰ Rezerv. baiga',
  custom: '✏️ Custom'
};

// TaskCountdown component - updates every second
function TaskCountdown({ dueAt, status }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const due = new Date(dueAt);
      const diff = due - now;

      if (diff < 0) {
        setIsOverdue(true);
        const absDiff = Math.abs(diff);
        const hours = Math.floor(absDiff / 3600000);
        const minutes = Math.floor((absDiff % 3600000) / 60000);
        setTimeLeft(`${hours}h ${minutes}m vėluoja`);
      } else {
        setIsOverdue(false);
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m likutis`);
        } else {
          setTimeLeft(`${minutes}m likutis`);
        }
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dueAt]);

  return (
    <span className={cn(
      'font-medium',
      isOverdue ? 'text-red-600' : (status === 'pending' ? 'text-orange-600' : 'text-blue-600')
    )}>
      {timeLeft}
    </span>
  );
}

export default function MyTasks() {
  const { user } = useOutletContext();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['myTasks', user?.id, statusFilter],
    queryFn: async () => {
      const response = await base44.functions.invoke('getTasks', {
        assignedToUserId: user.id,
        status: statusFilter === 'all' ? null : statusFilter
      });
      return response.data?.tasks || [];
    },
    enabled: !!user?.id
  });

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const response = await base44.functions.invoke('updateTaskStatus', {
        taskId,
        newStatus
      });
      if (response.data?.success) {
        // Optimistically update UI
        location.reload();
      }
    } catch (err) {
      console.error('Failed to update task:', err);
      alert('Nepavyko atnaujinti užduoties: ' + (err.response?.data?.error || err.message));
    }
  };

  const overdueTasks = tasks.filter(t => t.status === 'overdue').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  if (isLoading) {
    return <div className="text-center py-10">Kraunasi...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mano užduotys</h1>
        <p className="text-sm text-muted-foreground mt-1">Jūsų priskirtos užduotys ir follow-up</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-blue-600">{pendingTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-amber-600">{inProgressTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className={cn('text-2xl font-bold', overdueTasks > 0 ? 'text-red-600' : 'text-gray-400')}>
              {overdueTasks}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Iš viso</p>
            <p className="text-2xl font-bold text-primary">{tasks.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">Filtras:</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visos</SelectItem>
            <SelectItem value="pending">Laukiančios</SelectItem>
            <SelectItem value="in_progress">Vykdomos</SelectItem>
            <SelectItem value="overdue">Vėluojančios</SelectItem>
            <SelectItem value="completed">Baigtos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Nėra užduočių
            </CardContent>
          </Card>
        ) : (
          tasks.map(task => {
            const isOverdue = task.status === 'overdue' || (new Date(task.dueAt) < new Date() && task.status !== 'completed');

            return (
              <Card
                key={task.id}
                className={cn(
                  'border-2 transition hover:shadow-md',
                  STATUS_COLORS[task.status],
                  isOverdue && 'border-red-500'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm">{TYPE_LABELS[task.type]}</span>
                        <Badge className={PRIORITY_COLORS[task.priority]}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className={cn(
                          task.status === 'overdue' && 'border-red-500 text-red-600'
                        )}>
                          {task.status}
                        </Badge>
                      </div>

                      <h3 className="font-medium text-sm mb-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <TaskCountdown dueAt={task.dueAt} status={task.status} />
                        </div>
                        {task.escalationLevel > 0 && (
                          <div className={cn(
                            'flex items-center gap-1 font-medium',
                            task.escalationLevel === 1 ? 'text-amber-600' : 'text-red-600'
                          )}>
                            <Zap className="h-3 w-3" />
                            Level {task.escalationLevel}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 min-w-fit">
                      {task.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(task.id, 'in_progress')}
                        >
                          Pradėti
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(task.id, 'completed')}
                          className="text-green-600"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Baigti
                        </Button>
                      )}
                      {task.status === 'overdue' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(task.id, 'in_progress')}
                            className="text-red-600"
                          >
                            Grįžti
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(task.id, 'completed')}
                            className="text-green-600"
                          >
                            Baigti
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}