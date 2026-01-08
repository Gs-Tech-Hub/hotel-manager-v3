'use client';

/**
 * Client-side hook for checking page access.
 * NOTE: This is for UX purposes only. Real authorization happens on the server via middleware.
 */

import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import {
  getPageAccessRule,
  checkPageAccess,
} from '@/lib/auth/page-access';

export function usePageAccess() {
  const pathname = usePathname();
  const { user } = useAuth();

  const pageRule = getPageAccessRule(pathname);

  const hasAccess = user
    ? checkPageAccess(
        pageRule,
        user.roles || [],
        user.permissions || [],
        user.userType || 'employee'
      )
    : false;

  return {
    pathname,
    pageRule,
    hasAccess,
    requiredRoles: pageRule?.requiredRoles,
    requiredPermissions: pageRule?.requiredPermissions,
  };
}
