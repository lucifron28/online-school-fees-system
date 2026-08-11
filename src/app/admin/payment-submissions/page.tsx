import { PaymentSubmissionQueue } from '@/components/admin/payment-submission-queue';
import { requirePortalUser } from '@/server/auth/guards';

export default async function AdminPaymentSubmissionsPage() {
  await requirePortalUser(['ADMIN', 'FINANCE_STAFF'], '/login/admin');
  return <PaymentSubmissionQueue />;
}
