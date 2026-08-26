export interface NavigationMatchInput {
  href: string;
  name: string;
  pathname: string;
  portalPath: string;
}

/**
 * Matches route segments instead of arbitrary string prefixes. This keeps
 * `/parent/pay` from matching `/parent/payment-submissions` while preserving
 * active state for legitimate nested detail pages.
 */
export function isNavigationItemActive({
  href,
  name,
  pathname,
  portalPath,
}: NavigationMatchInput): boolean {
  const dashboardHref = `${portalPath}/dashboard`;
  if (href === dashboardHref && name === 'Dashboard') return pathname === href;
  if (href === dashboardHref) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
