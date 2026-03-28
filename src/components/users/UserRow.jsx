import React from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Eye, Ban, RotateCw, XCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import RoleBadge from './RoleBadge';
import UserStatusBadge from './UserStatusBadge';
import { CAN_MANAGE_USERS } from '@/lib/constants';

const CAN_VIEW = ['ADMIN', 'SALES_MANAGER'];

export default function UserRow({ user, invite, projectCount, currentUser, onDisable, onEnable, onResend, onRevoke }) {
  const canManage = CAN_MANAGE_USERS.includes(currentUser?.role);
  const canView = CAN_VIEW.includes(currentUser?.role);
  const isInvite = !!invite && !user;
  const displayName = isInvite ? (invite.email) : (user.full_name || 'Be vardo');
  const email = isInvite ? invite.email : user.email;
  const role = isInvite ? invite.role : user.role;
  const status = isInvite ? invite.status : (user.accountStatus || 'active');

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:border-primary/20 hover:shadow-sm transition-all duration-200">
      {/* Avatar */}
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-semibold text-muted-foreground">
          {displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <RoleBadge role={role} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-xs text-muted-foreground truncate">{email}</p>
          {!isInvite && projectCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {projectCount} proj.
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <UserStatusBadge status={status} />

      {/* Actions */}
      {(canManage || canView) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isInvite && (
              <>
                <DropdownMenuItem asChild>
                  <Link to={`/users/${user.id}`}>
                    <Eye className="h-4 w-4 mr-2" /> Peržiūrėti
                  </Link>
                </DropdownMenuItem>
                {canManage && (
                  <>
                    <DropdownMenuSeparator />
                    {(user.accountStatus || 'active') === 'active' ? (
                      <DropdownMenuItem onClick={() => onDisable(user)} className="text-destructive">
                        <Ban className="h-4 w-4 mr-2" /> Išjungti paskyrą
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onEnable(user)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Aktyvuoti paskyrą
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </>
            )}
            {isInvite && canManage && invite.status === 'pending' && (
              <>
                <DropdownMenuItem onClick={() => onResend(invite)}>
                  <RotateCw className="h-4 w-4 mr-2" /> Persiųsti pakvietimą
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRevoke(invite)} className="text-destructive">
                  <XCircle className="h-4 w-4 mr-2" /> Atšaukti pakvietimą
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}