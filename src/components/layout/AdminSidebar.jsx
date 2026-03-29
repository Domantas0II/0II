import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Users, FolderOpen, Building2, Package, Settings, LogOut, Mail, Kanban, Clock, Upload, LayoutDashboard, BadgeDollarSign, Wallet, ScrollText, BarChart2, Plug, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canManageUsers, canManageProjects, canAccessInbound, normalizeRole } from '@/lib/constants';
import { canViewPipeline } from '@/lib/pipelineAccess';
import { base44 } from '@/api/base44Client';

const menuItems = [
  {
    label: 'Kontrolė',
    icon: LayoutDashboard,
    href: '/dashboard',
    requiredRole: () => true,
  },
  {
    label: 'Vartotojai',
    icon: Users,
    href: '/users',
    requiredRole: (role) => canManageUsers(normalizeRole(role)),
  },
  {
    label: 'Projektai',
    icon: FolderOpen,
    href: '/projects',
    requiredRole: (role) => canManageProjects(normalizeRole(role)),
  },
  {
    label: 'Objektai',
    icon: Building2,
    href: '/units',
    requiredRole: (role) => canManageProjects(normalizeRole(role)),
  },
  {
    label: 'Komponentų baseinas',
    icon: Package,
    href: '/components',
    requiredRole: (role) => canManageProjects(normalizeRole(role)),
  },
  {
    label: 'Užklausa',
    icon: Mail,
    href: '/inquiry',
    requiredRole: (role) => canAccessInbound(normalizeRole(role)),
  },
  {
    label: 'Pipeline',
    icon: Kanban,
    href: '/pipeline',
    requiredRole: (role) => canViewPipeline(normalizeRole(role)),
  },
  {
    label: 'Rezervacijos',
    icon: Clock,
    href: '/reservations',
    requiredRole: (role) => canAccessInbound(normalizeRole(role)),
  },
  {
    label: 'Import & Bulk',
    icon: Upload,
    href: '/import',
    requiredRole: (role) => canManageProjects(normalizeRole(role)),
  },
  {
    label: 'Komisiniai',
    icon: BadgeDollarSign,
    href: '/commissions',
    requiredRole: (role) => canAccessInbound(normalizeRole(role)),
  },
  {
    label: 'Komisinių taisyklės',
    icon: ScrollText,
    href: '/commission-rules',
    requiredRole: (role) => ['ADMINISTRATOR', 'SALES_MANAGER'].includes(normalizeRole(role)),
  },
  {
    label: 'Payout',
    icon: Wallet,
    href: '/payouts',
    requiredRole: (role) => ['ADMINISTRATOR', 'SALES_MANAGER'].includes(normalizeRole(role)),
  },
  {
    label: 'Ataskaitos',
    icon: BarChart2,
    href: '/reports',
    requiredRole: (role) => ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT'].includes(normalizeRole(role)),
  },
  {
    label: 'Integracijos',
    icon: Plug,
    href: '/integrations',
    requiredRole: (role) => normalizeRole(role) === 'ADMINISTRATOR',
  },
  {
    label: 'System Health',
    icon: ShieldCheck,
    href: '/system-health',
    requiredRole: (role) => normalizeRole(role) === 'ADMINISTRATOR',
  },
  {
    label: 'Nustatymai',
    icon: Settings,
    href: '/branding',
    requiredRole: (role) => normalizeRole(role) === 'ADMINISTRATOR',
  },
];

export default function AdminSidebar({ open, branding }) {
  const { user } = useAuth();
  const location = useLocation();

  const visibleItems = menuItems.filter(item => {
    if (!item.requiredRole) return true;
    return item.requiredRole(user?.role);
  });

  const appName = branding?.appName || 'NT Sistema';

  return (
    <aside
      className={cn(
        'w-64 bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col overflow-hidden',
        !open && 'w-0'
      )}
    >
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-sidebar-foreground">{appName}</h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={() => base44.auth.logout()}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Atsijungti</span>
        </button>
      </div>
    </aside>
  );
}