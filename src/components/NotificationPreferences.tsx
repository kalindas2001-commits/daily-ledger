import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, CheckCircle2, XCircle, MessageSquare, RotateCcw, Loader2, CloudCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useNotificationPrefs, PrefEvent } from '@/hooks/useNotificationPrefs';

const ROWS: { key: PrefEvent; label: string; hint: string; icon: any }[] = [
  { key: 'approved', label: 'Edit request approved', hint: 'When an admin approves my transaction edit', icon: CheckCircle2 },
  { key: 'rejected', label: 'Edit request denied', hint: 'When an admin declines my transaction edit', icon: XCircle },
  { key: 'notes', label: 'Admin notes', hint: 'When an admin leaves a note on my request', icon: MessageSquare },
];

export default function NotificationPreferences() {
  const { prefs, toggle, reset, syncing, permission, requestWebAlerts } = useNotificationPrefs();
  const [busy, setBusy] = useState(false);

  const save = async (fn: () => Promise<void>) => {
    try { await fn(); toast.success('Notification preferences saved'); }
    catch (e: any) { toast.error(e?.message ?? 'Could not save preferences'); }
  };

  const enable = async () => {
    setBusy(true);
    const res = await requestWebAlerts();
    setBusy(false);
    if (res.state === 'ok') toast.success(res.message);
    else toast.error(res.message, { duration: 8000 });
  };

  const blocked = permission === 'denied';
  const unsupported = permission === 'unsupported';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Notification preferences
          {syncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
              <CloudCheck className="w-3.5 h-3.5" /> synced to your account
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <BellRing className="w-4 h-4 text-muted-foreground" />
            <span>Web alerts on this device</span>
            <Badge variant={permission === 'granted' ? 'secondary' : 'destructive'} className="text-[10px] uppercase">
              {permission}
            </Badge>
          </div>
          {permission !== 'granted' && (
            <Button size="sm" variant="outline" onClick={enable} disabled={busy || unsupported}>
              {busy && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Enable web alerts
            </Button>
          )}
        </div>

        {(blocked || unsupported) && (
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              {unsupported
                ? 'This browser does not support web alerts. In-app toasts will still work.'
                : 'Notifications are blocked for this site. Open your browser site settings, allow notifications for CungaCash, then press “Enable web alerts” again.'}
            </p>
          </div>
        )}

        <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-3 text-[10px] uppercase tracking-wider text-muted-foreground px-1">
          <span>Event</span><span className="w-20 text-center">In-app</span><span className="w-20 text-center">Web alert</span>
        </div>

        <div className="space-y-2">
          {ROWS.map(({ key, label, hint, icon: Icon }) => (
            <div key={key} className="rounded-lg border p-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              </div>
              <div className="flex gap-6 mt-3 sm:mt-0">
                <label className="flex items-center gap-2 sm:w-20 sm:justify-center">
                  <Switch checked={prefs[key].toast} onCheckedChange={(v) => save(() => toggle(key, 'toast', v))} />
                  <span className="text-xs text-muted-foreground sm:hidden">In-app</span>
                </label>
                <label className="flex items-center gap-2 sm:w-20 sm:justify-center">
                  <Switch
                    checked={prefs[key].web}
                    onCheckedChange={async (v) => {
                      if (v && permission !== 'granted') {
                        const res = await requestWebAlerts();
                        if (res.state !== 'ok') { toast.error(res.message, { duration: 8000 }); return; }
                      }
                      save(() => toggle(key, 'web', v));
                    }}
                  />
                  <span className="text-xs text-muted-foreground sm:hidden">Web alert</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <Button size="sm" variant="ghost" onClick={() => save(reset)} className="gap-2 text-muted-foreground">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
        </Button>
      </CardContent>
    </Card>
  );
}
