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

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: notifs }, { data: dismissals }] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('notification_dismissals').select('notification_id').eq('user_id', user.id),
    ]);
    setItems((notifs ?? []) as AppNotification[]);
    setDismissedIds(new Set((dismissals ?? []).map((d: any) => d.notification_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load();
    const ch = supabase
      .channel(`notifications-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_dismissals', filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  const dismiss = useCallback(
    async (id: string) => {
      if (!user) return;
      setDismissedIds((s) => new Set(s).add(id));
      await supabase.from('notification_dismissals').insert({ notification_id: id, user_id: user.id });
    },
    [user],
  );

  const visibleBanners = items.filter((n) => n.kind === 'banner' && !dismissedIds.has(n.id));
  const pendingPopups = items.filter((n) => n.kind === 'popup' && !dismissedIds.has(n.id));

  return { items, visibleBanners, pendingPopups, dismiss, loading, reload: load };
}
