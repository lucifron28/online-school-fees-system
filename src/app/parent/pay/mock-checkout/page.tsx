import { notFound } from 'next/navigation';
import { getServerEnv } from '@/lib/env';
import MockCheckoutClient from './mock-checkout-client';

export default function MockCheckoutPage() {
  if (!getServerEnv().ENABLE_MOCK_PAYMENT_HARNESS) notFound();
  return <MockCheckoutClient />;
}
