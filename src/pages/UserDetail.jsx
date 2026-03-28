import React, { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle, Plus, X, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import RoleBadge from '@/components/users/RoleBadge';
import UserStatusBadge from '@/components/users/UserStatusBadge';
import { ROLE_OPTIONS, canManageUsers } from '@/lib/constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function UserDetail() {
  const { user: currentUser } = useOutletContext();
  const queryClient = useQueryClient();
  const { id: userId } = useParams();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });
  const targetUser = users.find(u => u.id === userId);

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', userId],
    queryFn: () => base44.entities.UserProjectAssignment.filter({ userId }),
    enabled: !!userId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => base44.entities.UserInvitation.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-projectName'),
  });

  const activeAssignments = assignments.filter(a => !a.removedAt);
  const userInvite = invitations.find(inv => inv.email === targetUser?.email);
  const assignedProjectIds = new Set(activeAssignments.map(a => a.projectId));
  const availableProjects = projects.filter(p => !assignedProjectIds.has(p.id));

  const updateUser = useMutation({
    mutationFn: (data) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Vartotojas atnaujintas');
    },
  });

  const createAssignment = useMutation({
    mutationFn: (data) => base44.entities.UserProjectAssignment.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments', userId] }),
  });

  const updateAssignment = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserProjectAssignment.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignments', userId] }),
  });

  const createAudit = (action, details) => {
    base44.entities.AuditLog.create({
      action,
      performedByUserId: currentUser?.id,
      performedByName: currentUser?.full_name,
      targetUserId: userId,
      targetUserEmail: targetUser?.email,
      details: details ? JSON.stringify(details) : undefined,
    });
  };

  const [selectedProjectId, setSelectedProjectId] = useState('');

  const handleRoleChange = (newRole) => {
    updateUser.mutate({ role: newRole });
    createAudit('ROLE_CHANGED', { from: targetUser.role, to: newRole });
  };

  const handleToggleStatus = () => {
    const effectiveStatus = targetUser.accountStatus || 'active';
    const newStatus = effectiveStatus === 'active' ? 'disabled' : 'active';
    updateUser.mutate({ accountStatus: newStatus });
    createAudit(newStatus === 'disabled' ? 'USER_DISABLED' : 'USER_ENABLED');
    toast.success(newStatus === 'disabled' ? 'Paskyra išjungta' : 'Paskyra aktyvuota');
  };

  const handleAssignProject = () => {
    if (!selectedProjectId) return;
    const proj = projects.find(p => p.id === selectedProjectId);
    createAssignment.mutate({
      userId,
      userFullName: targetUser.full_name,
      projectId: selectedProjectId,
      projectName: proj?.projectName || selectedProjectId,
      assignedByUserId: currentUser?.id,
      assignedByName: currentUser?.full_name,
      assignedAt: new Date().toISOString(),
    });
    createAudit('PROJECT_ASSIGNED', { projectId: selectedProjectId, projectName: proj?.projectName });
    setSelectedProjectId('');
    toast.success('Projektas priskirtas');
  };

  const handleRemoveProject = (assignment) => {
    updateAssignment.mutate({
      id: assignment.id,
      data: { removedAt: new Date().toISOString() },
    });
    createAudit('PROJECT_REMOVED', { projectId: assignment.projectId, projectName: assignment.projectName });
    toast.success('Projektas pašalintas');
  };

  const canManage = canManageUsers(currentUser?.role);

  if (!targetUser) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Vartotojas nerastas</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Grįžti</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="gap-2 -ml-3">
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Vartotojai</Link>
      </Button>

      {/* User Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-muted-foreground">
                {(targetUser.full_name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{targetUser.full_name}</h2>
                <UserStatusBadge status={targetUser.accountStatus || 'active'} />
              </div>
              <p className="text-sm text-muted-foreground">{targetUser.email}</p>
              {targetUser.phoneNumber && (
                <p className="text-sm text-muted-foreground">{targetUser.phoneNumber}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <RoleBadge role={targetUser.role} />
                {userInvite && <UserStatusBadge status={userInvite.status} />}
              </div>
            </div>
            {canManage && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant={(targetUser.accountStatus || 'active') === 'active' ? 'destructive' : 'default'}
                    size="sm"
                    className="gap-2"
                  >
                    {(targetUser.accountStatus || 'active') === 'active' ? (
                      <><Ban className="h-3.5 w-3.5" /> Išjungti</>
                    ) : (
                      <><CheckCircle className="h-3.5 w-3.5" /> Aktyvuoti</>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {(targetUser.accountStatus || 'active') === 'active' ? 'Išjungti paskyrą?' : 'Aktyvuoti paskyrą?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {(targetUser.accountStatus || 'active') === 'active'
                        ? 'Išjungtas vartotojas negalės prisijungti, bet jo duomenys bus išsaugoti.'
                        : 'Vartotojas vėl galės prisijungti prie sistemos.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Atšaukti</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggleStatus}>Patvirtinti</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Sukurtas</p>
              <p className="text-sm font-medium mt-0.5">
                {targetUser.created_date ? format(new Date(targetUser.created_date), 'yyyy-MM-dd') : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Paskutinis prisijungimas</p>
              <p className="text-sm font-medium mt-0.5">
                {targetUser.lastLoginAt ? format(new Date(targetUser.lastLoginAt), 'yyyy-MM-dd HH:mm') : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Projektai</p>
              <p className="text-sm font-medium mt-0.5">{activeAssignments.length}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Telefonas</p>
              <p className="text-sm font-medium mt-0.5">{targetUser.phoneNumber || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Change */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vaidmuo</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={targetUser.role} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Project Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Priskirti projektai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage && (
            <div className="flex gap-2">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={availableProjects.length === 0 ? 'Visi projektai priskirti' : 'Pasirinkite projektą...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.projectName} <span className="text-muted-foreground text-xs">({p.projectCode})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssignProject} disabled={!selectedProjectId || createAssignment.isPending} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {activeAssignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nėra priskirtų projektų</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAssignments.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="text-sm font-medium">{a.projectName || a.projectId}</p>
                    <p className="text-xs text-muted-foreground">
                      Priskirta: {a.assignedByName || 'Nežinoma'} · {(a.assignedAt || a.created_date) ? format(new Date(a.assignedAt || a.created_date), 'yyyy-MM-dd') : ''}
                    </p>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveProject(a)}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}