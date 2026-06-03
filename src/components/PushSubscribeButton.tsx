import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { BellRing, BellOff } from 'lucide-react';
import { getPushPermission, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import { toast } from 'sonner';

export default function PushSubscribeButton() {
  const { t } = useTranslation();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPermission(getPushPermission()); }, []);

  if (!isPushSupported() || permission === 'unsupported') return null;

  const enable = async () => {
    setBusy(true);
    const ok = await subscribeToPush();
    setBusy(false);
    setPermission(getPushPermission());
    if (ok) toast.success(t('notifications.pushEnabled'));
    else if (Notification.permission === 'denied') toast.error(t('notifications.pushBlocked'));
  };

  const disable = async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    setPermission(getPushPermission());
    toast(t('notifications.title'));
  };

  if (permission === 'granted') {
    return (
      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" disabled={busy} onClick={disable}>
        <BellOff className="w-3.5 h-3.5" /> Disable push
      </Button>
    );
  }
  return (
    <Button variant="default" size="sm" className="w-full gap-2 text-xs" disabled={busy} onClick={enable}>
      <BellRing className="w-3.5 h-3.5" /> {t('notifications.enablePush')}
    </Button>
  );
}
