import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MessageSquareText, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useMoneyCapture } from '@/hooks/useMoneyCapture';
import { nativeSmsAvailable, PhoneMessages } from '@/lib/capture/nativeSms';
import { SMS_SYNC_INTERVAL_MS } from '@/lib/capture/sms';
import { restoreSmsCursor, syncCarrierMessages } from '@/lib/capture/sync';

type Account = { id: string; name: string };
type Stats = { checked: number; adverts: number; unrelated: number; queued: number; duplicates: number; lastRun: string | null };
const empty: Stats = { checked: 0, adverts: 0, unrelated: 0, queued: 0, duplicates: 0, lastRun: null };

export default function PhoneSmsSync({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation();
  const d = (key: string, fallback: string) => t(`capture.${key}`, { defaultValue: fallback });
  const { user } = useAuth();
  const { sources, consent, register } = useMoneyCapture('needs_review');
  const native = nativeSmsAvailable();
  const storeKey = `cungacash_sms_${user?.id ?? 'anon'}`;
  const [accountId, setAccountId] = useState(() => localStorage.getItem(`${storeKey}_account`) ?? '');
  const [permission, setPermission] = useState<string>('unknown');
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<Stats>(empty);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(() => localStorage.getItem(`${storeKey}_enabled`) === 'true');
  const [collectionReady, setCollectionReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const busy = useRef(false);
  const active = useRef(false);
  const consented = !!sources.data?.some(s => s.kind === 'sms' && s.enabled && s.consented_at);
  const allowed = native && !!user && enabled && permission === 'granted' && consented && accounts.some(a => a.id === accountId);
  const ready = allowed && collectionReady;
  active.current = ready;
  const registerMessage = register.mutateAsync;

  useEffect(() => {
    setAccountId(localStorage.getItem(`${storeKey}_account`) ?? '');
    setEnabled(localStorage.getItem(`${storeKey}_enabled`) === 'true');
    setStats(empty);
  }, [storeKey]);

  useEffect(() => {
    if (!native || sources.isPending) return;
    let cancelled = false;
    setCollectionReady(false);
    PhoneMessages.setCollection({ enabled: allowed, owner: user?.id }).then(() => {
      if (!cancelled) setCollectionReady(allowed);
    }).catch(() => { if (!cancelled) setError(d('smsNativeError', 'Update the Android app to enable phone-message collection.')); });
    return () => { cancelled = true; };
  }, [native, allowed, user?.id, sources.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (native) PhoneMessages.checkPermissions().then(r => setPermission(r.sms)).catch(() => setPermission('denied')); }, [native]);
  useEffect(() => { if (accountId) localStorage.setItem(`${storeKey}_account`, accountId); }, [accountId, storeKey]);

  const sync = useCallback(async () => {
    if (!ready || !user || busy.current) return;
    busy.current = true; setRunning(true); setError('');
    try {
      const pending = await PhoneMessages.readPending({ owner: user.id });
      setPendingCount(pending.messages.length);
      const next = await syncCarrierMessages({
        cursor: restoreSmsCursor(localStorage.getItem(`${storeKey}_cursor`)),
        read: cursor => PhoneMessages.readMessages({ ...cursor, limit: 100 }),
        save: (sms, text, record) => registerMessage({ kind: 'sms', accountId, name: `SMS ${sms.sender}`.slice(0, 120), text, records: [record] }),
        checkpoint: cursor => localStorage.setItem(`${storeKey}_cursor`, JSON.stringify(cursor)),
        active: () => active.current,
      });
      // Canonical carrier inbox timestamps prevent a background delivery event from becoming a second import.
      if (!next.hasMore) {
        for (const sms of pending.messages) await PhoneMessages.acknowledge({ owner: user.id, id: sms.id });
        setPendingCount(0);
      }
      setStats(prev => ({ checked: prev.checked + next.checked, adverts: prev.adverts + next.adverts, unrelated: prev.unrelated + next.unrelated, queued: prev.queued + next.queued, duplicates: prev.duplicates + next.duplicates, lastRun: new Date().toISOString() }));
      if (next.queued) toast.success(d('smsQueued', `${next.queued} payment message(s) added to your review inbox.`));
    } catch (e) {
      setError(e instanceof Error ? e.message : d('error', 'Could not complete this action.'));
    } finally { busy.current = false; setRunning(false); }
  }, [ready, user, storeKey, accountId, registerMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    sync();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') sync(); }, SMS_SYNC_INTERVAL_MS);
    const resume = () => {
      if (document.visibilityState === 'visible') PhoneMessages.checkPermissions().then(r => {
        setPermission(r.sms);
        if (r.sms === 'granted') sync();
      }).catch(() => setPermission('denied'));
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [ready, sync]);

  const askPermission = async () => {
    try {
      const r = await PhoneMessages.requestPermissions(); setPermission(r.sms);
      if (r.sms === 'granted') {
        if (!consented) await consent.mutateAsync({ kind: 'sms', enabled: true });
        localStorage.setItem(`${storeKey}_enabled`, 'true'); setEnabled(true);
      }
    } catch { setError(d('error', 'Could not complete this action.')); }
  };
  const stop = async () => {
    active.current = false; setEnabled(false); localStorage.removeItem(`${storeKey}_enabled`);
    try { await PhoneMessages.setCollection({ enabled: false }); setPendingCount(0); await consent.mutateAsync({ kind: 'sms', enabled: false }); }
    catch { setError(d('error', 'Could not complete this action.')); }
  };

  return <section className="space-y-4 rounded-md border bg-card p-4 text-card-foreground">
    <div className="flex items-center gap-3"><Smartphone className="size-6 shrink-0 text-primary" /><div className="min-w-0"><h3 className="font-semibold">{d('smsTitle', 'Phone payment messages')}</h3><p className="text-sm text-muted-foreground">{d('smsIntro', 'Carrier SMS · MTN MoMo, Airtel Money and banks')}</p></div></div>
    {!native ? <p role="note" className="border-l-4 border-primary bg-muted p-3 text-sm">{d('smsWebOnly', 'Automatic message reading works only in the CungaCash Android app. In a browser, iPhone or desktop, paste messages in the Import tab instead.')}</p> : <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="sms-account">{d('smsDestination', 'Destination account')}</Label><Select value={accountId} onValueChange={setAccountId} disabled={running}><SelectTrigger id="sms-account" className="min-h-11"><SelectValue placeholder={d('chooseAccount', 'Select an RWF account')} /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-end gap-2">
          {permission !== 'granted' || !consented || !enabled
            ? <Button className="min-h-11 w-full" onClick={askPermission} disabled={consent.isPending}><ShieldCheck />{d('smsAllow', 'Allow message access')}</Button>
            : <Button variant="outline" className="min-h-11 w-full" onClick={sync} disabled={!ready || running}>{running ? <Loader2 className="animate-spin" /> : <RefreshCw />}{d('smsSyncNow', 'Check now')}</Button>}
        </div>
      </div>
      <p className="text-sm text-foreground">{d('smsPrivacy', 'Allow access to carrier payment SMS on this phone and privately save payment evidence for review? Other conversations stay on your phone.')}</p>
      {enabled && <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{d('smsBackground', 'Background collection enabled · uploads resume in Money Capture. Android may delay delivery. Payments still require review.')}{pendingCount > 0 && ` (${pendingCount})`}</p><Button variant="outline" className="min-h-11" onClick={stop}>{d('smsStop', 'Stop message access')}</Button></div>}
      {permission === 'denied' && <p role="alert" className="text-sm text-destructive">{d('smsDenied', 'Message access was refused. Enable SMS permission for CungaCash in Android settings.')}</p>}
      {ready && <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">{([['checked', 'Checked'], ['queued', 'To review'], ['adverts', 'Adverts skipped'], ['unrelated', 'Not payments'], ['duplicates', 'Possible duplicates']] as const).map(([k, label]) => <div key={k} className="rounded-md bg-muted p-2"><dt className="text-xs text-muted-foreground">{d(`sms_${k}`, label)}</dt><dd className="font-semibold tabular-nums">{stats[k]}</dd></div>)}</dl>}
      {stats.lastRun && <p className="flex items-center gap-2 text-xs text-muted-foreground"><MessageSquareText className="size-3" />{d('smsLast', 'Last check')}: {new Date(stats.lastRun).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </>}
  </section>;
}
