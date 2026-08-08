import { AdministrationSettings } from '@/components/admin/administration-settings';
import { requirePortalUser } from '@/server/auth/guards';

export default async function AdminSettingsPage() {
  await requirePortalUser(['ADMIN'], '/login/admin');
  return <AdministrationSettings />;
}
