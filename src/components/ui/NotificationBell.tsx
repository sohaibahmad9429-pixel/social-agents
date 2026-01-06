'use client'

import React from 'react';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NotificationBellProps {
  className?: string;
  side?: 'bottom' | 'right';
}

const NotificationBell: React.FC<NotificationBellProps> = ({ className, side = 'bottom' }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotifications();

  const getTimeAgo = (dateString: string): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all duration-200 outline-none",
            className
          )}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-md shadow-red-500/30">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align={side === 'right' ? "start" : "center"}
        sideOffset={10}
        className="w-96 p-0 bg-card border-border shadow-2xl z-[100] max-h-[600px] overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-border flex justify-between items-center bg-card">
          <h3 className="text-lg font-bold text-foreground">Notifications</h3>
          {notifications.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 max-h-[500px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium">No notifications yet</p>
              <p className="text-muted-foreground text-xs mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-all duration-200 ${!notification.read ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                >
                  <div className="flex gap-3 items-start">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-foreground font-semibold text-sm truncate">{notification.title}</p>
                      <p className="text-muted-foreground text-sm mt-1 leading-relaxed break-words whitespace-normal">{notification.message}</p>
                      <p className="text-muted-foreground text-xs mt-2 font-medium">{getTimeAgo(notification.createdAt)}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-primary hover:text-primary/80 transition-colors p-1 hover:bg-primary/10 rounded-lg"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => clearNotification(notification.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 hover:bg-destructive/10 rounded-lg"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// OPTIMIZATION: Memoize NotificationBell (no props, so only re-renders on context changes)
export default React.memo(NotificationBell);
