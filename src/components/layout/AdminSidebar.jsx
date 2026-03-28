import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, UserPlus, Palette, Shield, ChevronLeft, ChevronRight, Building2, Home, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Vartotojai', icon: Users, exact: true },
  { path: '/projects', label: 'Projektai', icon: Building2 },
  { path: '/units', label: 'Objektai', icon: Home },
  { path: '/components', label: 'Dedamųjų pool', icon: Package },
  { path: '/invite', label: 'Pakviesti', icon: UserPlus },
  { path: '/branding', label: 'Branding', icon: Palette },
];

export default function AdminSidebar({ collapsed, onToggle, branding }) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <span className="ml-3 font-semibold text-sm truncate">
            {branding?.appName || 'NT Sistema'}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(item => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="h-12 flex items-center justify-center border-t border-sidebar-border hover:bg-sidebar-accent/50 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}