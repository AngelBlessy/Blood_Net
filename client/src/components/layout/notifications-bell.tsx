import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/session-store';
import { apiGet, apiPatch } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { NotificationItem } from '@/types/domain';

const POLL_INTERVAL_MS = 60_000;

export function NotificationsBell() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const refresh = useCallback(() => {
    apiGet<{ notifications: NotificationItem[] }>('/notifications/me')
      .then((data) => setNotifications(data.notifications))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      return;
    }
    refresh();
    // Poll as a fallback; the socket listener below is what makes new
    // notifications appear (and toast) immediately instead of up to 60s late.
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [session, refresh]);

  useEffect(() => {
    if (!session) return;
    const socket = getSocket();
    function handleNew(notification: NotificationItem) {
      setNotifications((prev) => [notification, ...prev]);
      toast.info(notification.title, { description: notification.message });
    }
    socket.on('notification:new', handleNew);
    return () => {
      socket.off('notification:new', handleNew);
    };
  }, [session]);

  if (!session) return null;

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  async function handleOpenChange(open: boolean) {
    if (!open) return;
    const unread = notifications.filter((notification) => !notification.isRead);
    if (!unread.length) return;
    await Promise.all(unread.map((notification) => apiPatch(`/notifications/${notification.id}/read`).catch(() => {})));
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('notificationsAria')}>
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t('notificationsTitle')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">{t('noNotifications')}</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 20).map((notification) => (
              <DropdownMenuItem key={notification.id} className="flex-col items-start gap-0.5 whitespace-normal">
                <span className={`text-sm font-medium ${notification.isRead ? '' : 'text-primary'}`}>
                  {notification.title}
                </span>
                <span className="text-xs text-muted-foreground">{notification.message}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
