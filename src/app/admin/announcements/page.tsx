import { Megaphone } from 'lucide-react';
import { AdminAnnouncementManagement } from '@/components/announcements/announcement-list';
import { Badge } from '@/components/ui/badge';

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          <Megaphone className="mr-1 h-3.5 w-3.5" /> Payment communications
        </Badge>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Announcements</h2>
        <p className="text-sm text-slate-500">
          Publish payment-related updates to parents and students.
        </p>
      </div>
      <AdminAnnouncementManagement />
    </div>
  );
}
