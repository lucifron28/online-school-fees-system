import { UserManagement } from '@/components/admin/user-management';
import { requirePortalUser } from '@/server/auth/guards';

export default async function AdminUsersPage() {
  await requirePortalUser(['ADMIN'], '/login/admin');
  return <UserManagement />;
}
