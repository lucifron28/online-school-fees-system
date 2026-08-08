import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NotificationHistory } from '@/components/notifications/notification-history';

export default function ParentNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <Bell className="mr-1 h-3.5 w-3.5" /> Account updates
        </Badge>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Notifications</h2>
        <p className="text-sm text-slate-500">Updates for your linked students and payments.</p>
      </div>
      <NotificationHistory />
    </div>
  );
}
