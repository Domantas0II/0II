import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Users, FolderOpen, Building2, Package, Settings, LogOut, Mail, Kanban, Clock, Upload, LayoutDashboard, BadgeDollarSign, Wallet, ScrollText, BarChart2, Plug, ShieldCheck, Rocket, FileText, CreditCard, Handshake, Home, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canManageUsers, canManageProjects, canAccessInbound, normalizeRole } from '@/lib/constants';
import { canViewPipeline } from '@/lib/pipelineAccess';
import { base44 } from '@/api/base44Client';

const menuItems = [
  {
    label: 'Suvestinė',
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
    label: 'Priklausiniai',
    icon: Package,
    href: '/components',
    requiredRole: (role) => canManageProjects(normalizeRole(role)),
  },
  {
    label: 'Užklausos',
    icon: Mail,
    href: '/inquiry',
    requiredRole: (role) => canAccessInbound(normalizeRole(role)),
  },
  {
    label: 'Pardavimų kanalas',
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
    label: 'Sutartys',
    icon: FileText,
    href: '/agreements',
    requiredRole: (role) => canAccessInbound(normalizeRole(role)),
  },
  {
    label: 'Mokėjimai',
    icon: CreditCard,
    href: '/payments',
    requiredRole: (role) => canAccessInbound(normalizeRole(role)),
  },
  {
    label: 'Sandoriai',
    icon: Handshake,
    href: '/deals',
    requiredRole: (role) => canAccessInbound(normalizeRole(role)),
  },
  {
    label: 'Importas',
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
    label: 'Išmokos',
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
    label: 'Sistemos sveikata',
    icon: ShieldCheck,
    href: '/system-health',
    requiredRole: (role) => normalizeRole(role) === 'ADMINISTRATOR',
  },
  {
    label: 'Paleidimo kontrolinis sąrašas',
    icon: Rocket,
    href: '/release-checklist',
    requiredRole: (role) => normalizeRole(role) === 'ADMINISTRATOR',
  },
  {
    label: 'Nustatymai',
    icon: Settings,
    href: '/branding',
    requiredRole: (role) => normalizeRole(role) === 'ADMINISTRATOR',
  },
];

const secondaryItems = [
  {
    label: 'Užklausos',
    icon: Mail,
    href: '/secondary-inquiries',
    requiredRole: (role) => ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT'].includes(normalizeRole(role)),
  },
  {
    label: 'Objektai',
    icon: Home,
    href: '/secondary-objects',
    requiredRole: (role) => ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT'].includes(normalizeRole(role)),
  },
  {
    label: 'Pirkėjai',
    icon: Users,
    href: '/secondary-buyers',
    requiredRole: (role) => ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT'].includes(normalizeRole(role)),
  },
  {
    label: 'Pipeline',
    icon: Kanban,
    href: '/secondary-pipeline',
    requiredRole: (role) => ['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT'].includes(normalizeRole(role)),
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

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
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

        {/* Secondary Market Section */}
        <div className="pt-4 mt-4 border-t border-sidebar-border">
          <p className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-sidebar-foreground/60">Antrinė rinka</p>
          <div className="space-y-1">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return item.requiredRole(user?.role) ? (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-purple-600/20 text-purple-600'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ) : null;
            })}
          </div>
        </div>
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