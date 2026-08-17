import { describe, expect, it } from 'vitest';
import { isNavigationItemActive } from '@/components/layout/navigation';
import { getPageCopy } from '@/components/layout/header';

describe('portal navigation route matching', () => {
  it('does not treat payment submissions as the make-payment route', () => {
    expect(
      isNavigationItemActive({
        href: '/parent/pay',
        name: 'Make Payment',
        pathname: '/parent/payment-submissions',
        portalPath: '/parent',
      })
    ).toBe(false);
  });

  it('keeps legitimate nested detail pages active', () => {
    expect(
      isNavigationItemActive({
        href: '/admin/transactions',
        name: 'Transactions',
        pathname: '/admin/transactions/receipt-123',
        portalPath: '/admin',
      })
    ).toBe(true);
  });

  it('only highlights the dashboard on its exact route', () => {
    expect(
      isNavigationItemActive({
        href: '/parent/dashboard',
        name: 'Dashboard',
        pathname: '/parent/dashboard',
        portalPath: '/parent',
      })
    ).toBe(true);
    expect(
      isNavigationItemActive({
        href: '/parent/dashboard',
        name: 'Dashboard',
        pathname: '/parent/children/student-123',
        portalPath: '/parent',
      })
    ).toBe(false);
  });

  it('resolves semantic copy for detail routes without exposing raw IDs', () => {
    expect(getPageCopy('/parent/children/student-123', 'Dashboard').title).toBe('Child account');
    expect(getPageCopy('/parent/receipts/receipt-123', 'Dashboard').title).toBe('Payment receipt');
    expect(getPageCopy('/admin/transactions/payment-123', 'Dashboard').title).toBe(
      'Transaction details'
    );
  });
});
