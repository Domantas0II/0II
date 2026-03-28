import React from 'react';
import { Menu, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';

const normalizeRole = (role) => {
  const map = { admin: 'ADMINISTRATOR', user: 'SALES_AGENT' };
  return map[role] || role;
};

const getRoleLabel = (role) => ROLE_LABELS[role] || role;

export default function AdminHeader({ user, onMobileMenuToggle }) {
  const rawRole = user?.role;
  const normalizedRole = normalizeRole(rawRole);
  const roleLabel = getRoleLabel(normalizedRole);

  const initials = (user?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
      <button onClick={onMobileMenuToggle} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted">
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden lg:block" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-muted transition-colors">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight">{user?.full_name || 'Vartotojas'}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <Badge variant="secondary" className="mt-1.5 text-[10px]">
              {roleLabel}
            </Badge>
            {normalizedRole === 'ADMINISTRATOR' && (
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                raw: {rawRole} → {normalizedRole}
              </p>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => base44.auth.logout()} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Atsijungti
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}