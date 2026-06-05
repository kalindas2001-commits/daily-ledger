import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BellRing, BellOff, RefreshCw } from 'lucide-react';
import { getPushPermission, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import { toast } from 'sonner';

export default function PushSubscribeButton() {
  const { t } = useTranslation();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [hasSub, setHasSub] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshStatus = async () => {
    setPermission(getPushPermission());
    if (!isPushSupported()) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setHasSub(!!sub);
    } catch { setHasSub(false); }
  };

  useEffect(() => { refreshStatus(); }, []);

  if (!isPushSupported() || permission === 'unsupported') {
    return <p className="text-[11px] text-muted-foreground px-2 py-1">Push not supported on this device/browser.</p>;
  }

  const enable = async () => {
    setBusy(true);
    const ok = await subscribeToPush();
    setBusy(false);
    await refreshStatus();
    if (ok) toast.success(t('notifications.pushEnabled', { defaultValue: 'Push notifications enabled' }));
    else if (Notification.permission === 'denied') toast.error(t('notifications.pushBlocked', { defaultValue: 'Notifications blocked in browser settings' }));
    else toast.error('Could not enable push (open the published app in a real browser, not preview)');
  };

  const disable = async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    await refreshStatus();
    toast(t('notifications.pushDisabled', { defaultValue: 'Push notifications disabled' }));
  };

  const refresh = async () => {
    setBusy(true);
    await unsubscribeFromPush();
    const ok = await subscribeToPush();
    setBusy(false);
    await refreshStatus();
    toast[ok ? 'success' : 'error'](ok ? 'Push subscription refreshed' : 'Refresh failed');
  };

  const active = permission === 'granted' && hasSub;
  const statusLabel =
    permission === 'denied' ? 'Blocked by browser'
    : active ? 'Enabled on this device'
    : permission === 'granted' ? 'Allowed, not subscribed'
    : 'Not enabled';
  const statusColor =
    active ? 'bg-primary' : permission === 'denied' ? 'bg-destructive' : 'bg-muted-foreground';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
        <span>{statusLabel}</span>
      </div>
      <div className="flex gap-1">
        {active ? (
          <>
            <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2 text-xs" disabled={busy} onClick={disable}>
              <BellOff className="w-3.5 h-3.5" /> Disable
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" disabled={busy} onClick={refresh} title="Refresh subscription">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </>
        ) : (
          <Button variant="default" size="sm" className="w-full gap-2 text-xs" disabled={busy || permission === 'denied'} onClick={enable}>
            <BellRing className="w-3.5 h-3.5" /> {t('notifications.enablePush', { defaultValue: 'Enable push notifications' })}
          </Button>
        )}
      </div>
    </div>
  );
}
