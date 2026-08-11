import { Megaphone } from 'lucide-react';
import { PortalAnnouncementList } from '@/components/announcements/announcement-list';
import { Badge } from '@/components/ui/badge';

export default function StudentAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
          <Megaphone className="mr-1 h-3.5 w-3.5" /> Student updates
        </Badge>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Announcements</h2>
        <p className="text-sm text-slate-500">Current payment updates from the school.</p>
      </div>
      <PortalAnnouncementList audience="STUDENT" />
    </div>
  );
}
