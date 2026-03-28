import React from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [branding, setBranding] = React.useState(null);

  React.useEffect(() => {
    // Load global branding
    const loadBranding = async () => {
      try {
        const res = await base44.entities.GlobalBranding.list();
        if (res && res.length > 0) {
          setBranding(res[0]);
        }
      } catch (error) {
        console.error('Failed to load branding:', error);
      }
    };

    if (user?.id) {
      loadBranding();
    }
  }, [user?.id]);

  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar open={sidebarOpen} branding={branding} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ user, branding }} />
        </main>
      </div>
    </div>
  );
}