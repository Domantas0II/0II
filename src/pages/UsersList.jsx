import React, { useState, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import UsersFilters from '@/components/users/UsersFilters';
import UserRow from '@/components/users/UserRow';
import { canManageUsers } from '@/lib/constants';

export default function UsersList() {
  const context = useOutletContext() || {};
  const { user: currentUser } = context;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', role: 'all', status: 'all', project: 'all' });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => base44.entities.UserInvitation.list('-created_date'),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => base44.entities.UserProjectAssignment.filter({ removedAt: null }),
    initialData: [],
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const updateInvite = useMutation({
    mutationFn: ({ id, data }) => base44.entities.UserInvitation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  });

  const createAudit = (action, targetId, targetEmail, details) => {
    base44.entities.AuditLog.create({
      action,
      performedByUserId: currentUser?.id,
      performedByName: currentUser?.full_name,
      targetUserId: targetId,
      targetUserEmail: targetEmail,
      details: details ? JSON.stringify(details) : undefined,
    });
  };

  const handleDisable = (u) => {
    updateUser.mutate({ id: u.id, data: { accountStatus: 'disabled' } });
    createAudit('USER_DISABLED', u.id, u.email);
    toast.success('Vartotojas išjungtas');
  };

  const handleEnable = (u) => {
    updateUser.mutate({ id: u.id, data: { accountStatus: 'active' } });
    createAudit('USER_ENABLED', u.id, u.email);
    toast.success('Vartotojas aktyvuotas');
  };

  const handleResend = (inv) => {
    const newExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    updateInvite.mutate({ id: inv.id, data: { expiresAt: newExpiry, status: 'pending' } });
    createAudit('INVITE_RESENT', null, inv.email);
    toast.success('Pakvietimas persiųstas');
  };

  const handleRevoke = (inv) => {
    updateInvite.mutate({ id: inv.id, data: { status: 'revoked' } });
    createAudit('INVITE_REVOKED', null, inv.email);
    toast.success('Pakvietimas atšauktas');
  };

  const projectCountMap = useMemo(() => {
    const map = {};
    assignments.forEach(a => {
      if (!a.removedAt) {
        map[a.userId] = (map[a.userId] || 0) + 1;
      }
    });
    return map;
  }, [assignments]);

  // Build combined list of users + pending invites (that don't match an existing user)
  const userEmails = new Set(users.map(u => u.email));
  const pendingInvites = invitations.filter(
    inv => ['pending', 'expired'].includes(inv.status) && !userEmails.has(inv.email)
  );

  // Check expired invites
  const now = new Date();
  pendingInvites.forEach(inv => {
    if (inv.status === 'pending' && new Date(inv.expiresAt) < now) {
      base44.entities.UserInvitation.update(inv.id, { status: 'expired' });
    }
  });

  // Build project filter sets
  const usersWithAllProjects = new Set(
    assignments.filter(a => !a.removedAt && a.allProjects).map(a => a.userId)
  );
  const usersByProject = {};
  assignments.filter(a => !a.removedAt).forEach(a => {
    if (!usersByProject[a.projectKey]) usersByProject[a.projectKey] = new Set();
    usersByProject[a.projectKey].add(a.userId);
  });

  const filteredUsers = users.filter(u => {
    const effectiveStatus = u.accountStatus || 'active';
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!(u.full_name || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
    }
    if (filters.role !== 'all' && u.role !== filters.role) return false;
    if (filters.status === 'active' && effectiveStatus !== 'active') return false;
    if (filters.status === 'disabled' && effectiveStatus !== 'disabled') return false;
    if (filters.status === 'pending') return false;
    if (filters.project !== 'all') {
      if (filters.project === 'allProjects') {
        if (!usersWithAllProjects.has(u.id)) return false;
      } else {
        const inProject = usersByProject[filters.project]?.has(u.id);
        if (!inProject && !usersWithAllProjects.has(u.id)) return false;
      }
    }
    return true;
  });

  const filteredInvites = filters.status === 'pending' || filters.status === 'all'
    ? pendingInvites.filter(inv => {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (!inv.email.toLowerCase().includes(q)) return false;
        }
        if (filters.role !== 'all' && inv.role !== filters.role) return false;
        if (filters.status !== 'all' && filters.status !== 'pending') return false;
        return true;
      })
    : [];

  const canManage = canManageUsers(currentUser?.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vartotojai</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} vartotoj{users.length === 1 ? 'as' : 'ai'} · {pendingInvites.filter(i => i.status === 'pending').length} laukia pakvietimo
          </p>
        </div>
        {canManage && (
          <Button asChild className="gap-2">
            <Link to="/invite">
              <UserPlus className="h-4 w-4" />
              Pakviesti vartotoją
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <UsersFilters filters={filters} onFilterChange={setFilters} />

      {/* List */}
      <div className="space-y-2">
        {loadingUsers ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-[72px] bg-card rounded-xl border border-border animate-pulse" />
          ))
        ) : (
          <>
            {filteredInvites.map(inv => (
              <UserRow
                key={`inv-${inv.id}`}
                invite={inv}
                currentUser={currentUser}
                onResend={handleResend}
                onRevoke={handleRevoke}
                projectCount={0}
              />
            ))}
            {filteredUsers.map(u => (
              <UserRow
                key={u.id}
                user={u}
                currentUser={currentUser}
                projectCount={projectCountMap[u.id] || 0}
                onDisable={handleDisable}
                onEnable={handleEnable}
              />
            ))}
            {filteredUsers.length === 0 && filteredInvites.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nerasta vartotojų pagal pasirinktus filtrus</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}