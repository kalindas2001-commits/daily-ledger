import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subscribeToPush, getPushPermission, isPushSupported } from '@/lib/push';

export type PrefEvent = 'approved' | 'rejected' | 'notes';
export type PrefChannel = 'toast' | 'web';

export interface NotificationPrefs {
  approved: { toast: boolean; web: boolean };
  rejected: { toast: boolean; web: boolean };
  notes: { toast: boolean; web: boolean };
}

const KEY = 'cungacash:notification_prefs';

export const DEFAULT_PREFS: NotificationPrefs = {
  approved: { toast: true, web: true },
  rejected: { toast: true, web: true },
  notes: { toast: true, web: false },
};

function merge(parsed: any): NotificationPrefs {
  return {
    approved: { ...DEFAULT_PREFS.approved, ...(parsed?.approved ?? {}) },
    rejected: { ...DEFAULT_PREFS.rejected, ...(parsed?.rejected ?? {}) },
    notes: { ...DEFAULT_PREFS.notes, ...(parsed?.notes ?? {}) },
  };
}

function readLocal(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return merge(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFS;
  }
}

/** In-memory cache so realtime callbacks can read prefs synchronously. */
let cache: NotificationPrefs = readLocal();

/** Read prefs synchronously (for use inside realtime callbacks). */
export function getNotificationPrefs(): NotificationPrefs {
  return cache;
}

function writeLocal(next: NotificationPrefs) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

/** Persist prefs to the backend so choices follow the user across devices. */
async function persistRemote(next: NotificationPrefs) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await (supabase as any)
    .from('notification_preferences')
    .upsert({ user_id: user.id, prefs: next }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Load prefs from the backend, falling back to whatever is cached locally. */
export async function loadRemotePrefs(): Promise<NotificationPrefs> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return cache;
    const { data, error } = await (supabase as any)
      .from('notification_preferences')
      .select('prefs')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data?.prefs) {
      const next = merge(data.prefs);
      writeLocal(next);
      return next;
    }
  } catch {
    /* offline / not signed in — keep local copy */
  }
  return cache;
}

export type WebAlertState = 'ok' | 'unsupported' | 'denied' | 'default' | 'error';

/** Ask for notification permission and register the push subscription. */
export async function enableWebAlerts(): Promise<{ state: WebAlertState; message: string }> {
  if (!isPushSupported() && typeof Notification === 'undefined') {
    return { state: 'unsupported', message: 'This device or browser does not support web alerts.' };
  }
  try {
    if (Notification.permission === 'denied') {
      return {
        state: 'denied',
        message: 'Notifications are blocked for this site. Enable them in your browser site settings, then try again.',
      };
    }
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      return { state: 'default', message: 'Permission was not granted, so web alerts stay off on this device.' };
    }
    if (isPushSupported()) {
      const ok = await subscribeToPush();
      if (!ok) {
        return {
          state: 'ok',
          message: 'Web alerts enabled on this device. Background push could not be registered here (it works on the installed app).',
        };
      }
    }
    return { state: 'ok', message: 'Web alerts enabled and this device registered for background notifications.' };
  } catch (e: any) {
    return { state: 'error', message: e?.message ?? 'Could not enable web alerts on this device.' };
  }
}

/** Fire a native browser notification. Returns a reason when it could not show. */
export function showWebAlert(title: string, body?: string): WebAlertState {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') return 'default';
    new Notification(title, { body, icon: '/icon-192.png', tag: `cc-${Date.now()}` });
    return 'ok';
  } catch {
    return 'error';
  }
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => cache);
  const [syncing, setSyncing] = useState(true);
  const [permission, setPermission] = useState(() => getPushPermission());

  useEffect(() => {
    let alive = true;
    loadRemotePrefs().then((p) => { if (alive) { setPrefs(p); setSyncing(false); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) { const p = readLocal(); cache = p; setPrefs(p); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(async (event: PrefEvent, channel: PrefChannel, value: boolean) => {
    const next = { ...cache, [event]: { ...cache[event], [channel]: value } } as NotificationPrefs;
    writeLocal(next);
    setPrefs(next);
    await persistRemote(next);
  }, []);

  const reset = useCallback(async () => {
    writeLocal(DEFAULT_PREFS);
    setPrefs(DEFAULT_PREFS);
    await persistRemote(DEFAULT_PREFS);
  }, []);

  const requestWebAlerts = useCallback(async () => {
    const res = await enableWebAlerts();
    setPermission(getPushPermission());
    return res;
  }, []);

  return { prefs, toggle, reset, syncing, permission, requestWebAlerts };
}
