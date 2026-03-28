import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { cn } from '@/lib/utils';

async function processInviteAccept(user) {
  // Find a pending invite for this user's email
  const invites = await base44.entities.UserInvitation.filter({ email: user.email, status: 'pending' });
  const invite = invites?.[0];
  if (!invite) return;

  const now = new Date();
  if (new Date(invite.expiresAt) < now) {
    await base44.entities.UserInvitation.update(invite.id, { status: 'expired' });
    return;
  }

  // Mark invite accepted
  await base44.entities.UserInvitation.update(invite.id, { status: 'accepted' });

  // Create project assignments from invite
  if (invite.projectKeys?.length > 0) {
    for (const key of invite.projectKeys) {
      await base44.entities.UserProjectAssignment.create({
        userId: user.id,
        userFullName: user.full_name,
        projectKey: key,
        projectName: key,
        assignedByUserId: invite.invitedByUserId,
        assignedByName: invite.invitedByName,
        assignedAt: now.toISOString(),
      });
    }
  }

  // Record audit
  await base44.entities.AuditLog.create({
    action: 'INVITE_ACCEPTED',
    performedByUserId: user.id,
    performedByName: user.full_name,
    targetUserEmail: user.email,
  });
}

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Run invite accept flow silently on first load
      processInviteAccept(u).catch(() => {});
    }).catch(() => {});
  }, []);

  const { data: brandings } = useQuery({
    queryKey: ['globalBranding'],
    queryFn: () => base44.entities.GlobalBranding.list(),
    initialData: [],
  });
  const branding = brandings?.[0] || null;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          branding={branding}
        />
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10">
            <AdminSidebar collapsed={false} onToggle={() => setMobileMenuOpen(false)} branding={branding} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[240px]"
      )}>
        <AdminHeader user={user} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="p-4 lg:p-6 max-w-7xl mx-auto">
          <Outlet context={{ user, branding }} />
        </main>
      </div>
    </div>
  );
}