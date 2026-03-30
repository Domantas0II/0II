import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  Users, FolderOpen, Building2, Package, Settings, LogOut, Mail,
  Kanban, Clock, Upload, LayoutDashboard, BadgeDollarSign, Wallet,
  ScrollText, BarChart2, Plug, ShieldCheck, FileText, CreditCard,
  Handshake, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canManageUsers, canManageProjects, canAccessInbound, normalizeRole } from '@/lib/constants';
import { canViewPipeline } from '@/lib/pipelineAccess';
import { base44 } from '@/api/base44Client';

const menuItems = [
  { label: 'Suvestinė', icon: LayoutDashboard, href: '/dashboard', requiredRole: () => true },
  { label: 'Vartotojai', icon: Users, href: '/users', requiredRole: (r) => canManageUsers(normalizeRole(r)) },
  { label: 'Projektai', icon: FolderOpen, href: '/projects', requiredRole: (r) => canManageProjects(normalizeRole(r)) },
  { label: 'Objektai', icon: Building2, href: '/units', requiredRole: (r) => canManageProjects(normalizeRole(r)) },
  { label: 'Priklausiniai', icon: Package, href: '/components', requiredRole: (r) => canManageProjects(normalizeRole(r)) },
  { label: 'Užklausos', icon: Mail, href: '/inquiry', requiredRole: (r) => canAccessInbound(normalizeRole(r)) },
  { label: 'Pardavimų kanalas', icon: Kanban, href: '/pipeline', requiredRole: (r) => canViewPipeline(normalizeRole(r)) },
  { label: 'Rezervacijos', icon: Clock, href: '/reservations', requiredRole: (r) => canAccessInbound(normalizeRole(r)) },
  { label: 'Sutartys', icon: FileText, href: '/agreements', requiredRole: (r) => canAccessInbound(normalizeRole(r)) },
  { label: 'Mokėjimai', icon: CreditCard, href: '/payments', requiredRole: (r) => canAccessInbound(normalizeRole(r)) },
  { label: 'Sandoriai', icon: Handshake, href: '/deals', requiredRole: (r) => canAccessInbound(normalizeRole(r)) },
  { label: 'Komisiniai', icon: BadgeDollarSign, href: '/commissions', requiredRole: (r) => canAccessInbound(normalizeRole(r)) },
  { label: 'Komisinių taisyklės', icon: ScrollText, href: '/commission-rules', requiredRole: (r) => ['ADMINISTRATOR','SALES_MANAGER'].includes(normalizeRole(r)) },
  { label: 'Išmokos', icon: Wallet, href: '/payouts', requiredRole: (r) => ['ADMINISTRATOR','SALES_MANAGER'].includes(normalizeRole(r)) },
  { label: 'Ataskaitos', icon: BarChart2, href: '/reports', requiredRole: (r) => ['ADMINISTRATOR','SALES_MANAGER','SALES_AGENT'].includes(normalizeRole(r)) },
  { label: 'Importas', icon: Upload, href: '/import', requiredRole: (r) => canManageProjects(normalizeRole(r)) },
  { label: 'Integracijos', icon: Plug, href: '/integrations', requiredRole: (r) => normalizeRole(r) === 'ADMINISTRATOR' },
  { label: 'Sistemos sveikata', icon: ShieldCheck, href: '/system-health', requiredRole: (r) => normalizeRole(r) === 'ADMINISTRATOR' },
  { label: 'Nustatymai', icon: Settings, href: '/branding', requiredRole: (r) => normalizeRole(r) === 'ADMINISTRATOR' },
];

export default function MobileMenu({ open, onClose, branding }) {
  const { user } = useAuth();
  const location = useLocation();

  const visibleItems = menuItems.filter(item => !item.requiredRole || item.requiredRole(user?.role));
  const appName = branding?.appName || 'NT Sistema';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-sidebar-foreground">{appName}</h1>
        <button
          onClick={onClose}
          className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-sidebar-accent text-sidebar-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-4 pb-6 pt-3 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/50 px-4 mb-2">{user?.full_name || user?.email}</p>
        <button
          onClick={() => base44.auth.logout()}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Atsijungti</span>
        </button>
      </div>
    </div>
  );
}