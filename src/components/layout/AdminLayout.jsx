import React from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import MobileMenu from './MobileMenu';

export default function AdminLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [branding, setBranding] = React.useState(null);

  React.useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await base44.entities.GlobalBranding.list();
        if (res && res.length > 0) setBranding(res[0]);
      } catch (error) {
        console.error('Failed to load branding:', error);
      }
    };
    if (user?.id) loadBranding();
  }, [user?.id]);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <AdminSidebar open={sidebarOpen} branding={branding} />
      </div>

      {/* Mobile fullscreen menu */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        branding={branding}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminHeader
          user={user}
          onMenuClick={() => {
            // Mobile: toggle fullscreen menu; Desktop: toggle sidebar
            if (window.innerWidth < 768) {
              setMobileMenuOpen(prev => !prev);
            } else {
              setSidebarOpen(prev => !prev);
            }
          }}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={{ user, branding }} />
        </main>
      </div>
    </div>
  );
}