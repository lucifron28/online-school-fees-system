import { Megaphone } from 'lucide-react';
import { PortalAnnouncementList } from '@/components/announcements/announcement-list';
import { Badge } from '@/components/ui/badge';

export default function ParentAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <Megaphone className="mr-1 h-3.5 w-3.5" /> Family updates
        </Badge>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Announcements</h2>
        <p className="text-sm text-slate-500">Current payment updates for your family.</p>
      </div>
      <PortalAnnouncementList audience="PARENT" />
    </div>
  );
}
