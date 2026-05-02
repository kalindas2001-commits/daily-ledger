import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: 'banner' | 'popup';
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // ✅ SAFE LOAD (fixes all 4 issues: null user, Supabase error, crash safety, stuck loading)
  const load = useCallback(async () => {
    try {
      // 1. USER NULL SAFETY (fix stuck loading)
      if (!user?.id) {
        setItems([]);
        setDismissedIds(new Set());
        setLoading(false);
        return;
      }

      setLoading(true);

      // 2. SAFE SUPABASE CALLS (no silent failures)
      const [notifRes, dismissRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('notification_dismissals')
          .select('notification_id')
          .eq('user_id', user.id),
      ]);

      // 3. SUPABASE ERROR HANDLING (fix empty UI issue)
      if (notifRes.error || dismissRes.error) {
        console.error('Notification load error:', notifRes.error || dismissRes.error);
        setItems([]);
        setDismissedIds(new Set());
        setLoading(false);
        return;
      }

      // 4. SAFE DATA PARSING (fix .map crash)
      const notifications = Array.isArray(notifRes.data) ? notifRes.data : [];
      const dismissals = Array.isArray(dismissRes.data) ? dismissRes.data : [];

      setItems(notifications as AppNotification[]);

      setDismissedIds(
        new Set(dismissals.map((d: any) => d.notification_id))
      );

      setLoading(false);
    } catch (err) {
      // 5. GLOBAL SAFETY NET (prevents white screen)
      console.error('Unexpected error loading notifications:', err);
      setItems([]);
      setDismissedIds(new Set());
      setLoading(false);
    }
  }, [user?.id]);

  // ✅ EFFECT (fix realtime spam + infinite rerenders)
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    load();

    // 6. STABLE CHANNEL (prevents duplication + spam)
    const channelName = `notifications-${user.id}`;

    const ch = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => load()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_dismissals',
          filter: `user_id=eq.${user.id}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, load]);

  // ✅ DISMISS SAFE (no crash, no race conditions)
  const dismiss = useCallback(
    async (id: string) => {
      if (!user?.id) return;

      // optimistic update (instant UI feedback)
      setDismissedIds((prev) => new Set(prev).add(id));

      try {
        const { error } = await supabase
          .from('notification_dismissals')
          .insert({ notification_id: id, user_id: user.id });

        if (error) {
          console.error('Dismiss error:', error);
          // rollback on failure
          setDismissedIds((prev) => {
            const copy = new Set(prev);
            copy.delete(id);
            return copy;
          });
        }
      } catch (err) {
        console.error('Unexpected dismiss error:', err);
      }
    },
    [user?.id]
  );

  // ✅ FILTERS (safe and fast)
  const visibleBanners = items.filter(
    (n) => n.kind === 'banner' && !dismissedIds.has(n.id)
  );

  const pendingPopups = items.filter(
    (n) => n.kind === 'popup' && !dismissedIds.has(n.id)
  );

  return {
    items,
    visibleBanners,
    pendingPopups,
    dismiss,
    loading,
    reload: load,
  };
}
