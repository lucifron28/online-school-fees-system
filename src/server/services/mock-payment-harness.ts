import { getServerEnv } from '@/lib/env';
import { NotFoundError } from '@/server/errors';

/**
 * The persisted mock checkout is a test harness only. It must be explicitly
 * enabled in a test/CI process before it can create or mutate financial data.
 */
export function isMockPaymentHarnessEnabled() {
  return getServerEnv().ENABLE_MOCK_PAYMENT_HARNESS === true;
}

export function assertMockPaymentHarnessEnabled() {
  if (!isMockPaymentHarnessEnabled()) {
    throw new NotFoundError('The requested resource does not exist.');
  }
}
