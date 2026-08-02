import { useCallback, useEffect, useState } from 'react';

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

function read(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      approved: { ...DEFAULT_PREFS.approved, ...(parsed?.approved ?? {}) },
      rejected: { ...DEFAULT_PREFS.rejected, ...(parsed?.rejected ?? {}) },
      notes: { ...DEFAULT_PREFS.notes, ...(parsed?.notes ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Read prefs synchronously (for use inside realtime callbacks). */
export function getNotificationPrefs(): NotificationPrefs {
  return read();
}

/** Fire a native browser notification if permission is granted. */
export function showWebAlert(title: string, body?: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: '/favicon.ico', tag: `cc-${Date.now()}` });
  } catch {
    /* ignore */
  }
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => read());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPrefs(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((event: PrefEvent, channel: PrefChannel, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [event]: { ...prev[event], [channel]: value } };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_PREFS));
    setPrefs(DEFAULT_PREFS);
  }, []);

  return { prefs, toggle, reset };
}
