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
import { analyzeSms, compareSmsRecords, smsEvidence, SMS_SYNC_INTERVAL_MS } from '@/lib/capture/sms';
import type { CaptureRecord } from '@/lib/capture/parser';

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
  const busy = useRef(false);
  const consented = !!sources.data?.some(s => s.kind === 'sms' && s.enabled && s.consented_at);
  const ready = native && permission === 'granted' && consented && accounts.some(a => a.id === accountId);

  useEffect(() => { if (native) PhoneMessages.checkPermissions().then(r => setPermission(r.sms)).catch(() => setPermission('denied')); }, [native]);
  useEffect(() => { if (accountId) localStorage.setItem(`${storeKey}_account`, accountId); }, [accountId, storeKey]);

  const sync = useCallback(async () => {
    if (!ready || busy.current) return;
    busy.current = true; setRunning(true); setError('');
    const cursorRaw = localStorage.getItem(`${storeKey}_cursor`);
    let cursor = cursorRaw ? JSON.parse(cursorRaw) as { after: number; afterId: string } : { after: Date.now() - 7 * 86400000, afterId: '0' };
    const seen: CaptureRecord[] = [];
    const next: Stats = { ...empty, lastRun: new Date().toISOString() };
    try {
      for (let page = 0; page < 10; page++) {
        const res = await PhoneMessages.readMessages({ ...cursor, limit: 100 });
        for (const sms of res.messages) {
          next.checked++;
          const result = analyzeSms(sms);
          if (result.kind === 'advertisement') { next.adverts++; continue; }
          if (result.kind === 'unrelated' || !result.record) { next.unrelated++; continue; }
          const dup = seen.find(r => compareSmsRecords(r, result.record!).relation !== 'distinct');
          if (dup) {
            const cmp = compareSmsRecords(dup, result.record);
            result.record.findings.push(`Possible duplicate of another message in this sync${cmp.differences.length ? ` — differs by ${cmp.differences.join(', ')}` : ''}.`);
            next.duplicates++;
          }
          seen.push(result.record);
          await register.mutateAsync({ kind: 'sms', accountId, name: `SMS ${sms.sender}`.slice(0, 120), text: smsEvidence(sms), records: [result.record] });
          next.queued++;
        }
        cursor = res.cursor;
        localStorage.setItem(`${storeKey}_cursor`, JSON.stringify(cursor));
        if (!res.hasMore) break;
      }
      setStats(prev => ({ checked: prev.checked + next.checked, adverts: prev.adverts + next.adverts, unrelated: prev.unrelated + next.unrelated, queued: prev.queued + next.queued, duplicates: prev.duplicates + next.duplicates, lastRun: next.lastRun }));
      if (next.queued) toast.success(d('smsQueued', `${next.queued} payment message(s) added to your review inbox.`));
    } catch (e) {
      setError(e instanceof Error ? e.message : d('error', 'Could not complete this action.'));
    } finally { busy.current = false; setRunning(false); }
  }, [ready, storeKey, accountId, register]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    sync();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') sync(); }, SMS_SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ready, sync]);

  const askPermission = async () => {
    try {
      const r = await PhoneMessages.requestPermissions(); setPermission(r.sms);
      if (r.sms === 'granted' && !consented) await consent.mutateAsync({ kind: 'sms', enabled: true });
    } catch { setError(d('error', 'Could not complete this action.')); }
  };

  return <section className="space-y-4 rounded-md border bg-card p-4 text-card-foreground">
    <div className="flex items-start gap-3"><Smartphone className="mt-1 size-6 shrink-0 text-primary" /><div className="min-w-0"><h3 className="font-semibold">{d('smsTitle', 'Phone payment messages')}</h3><p className="text-sm text-muted-foreground">{d('smsIntro', 'Reads MTN MoMo, Airtel Money and bank messages on this phone, skips adverts, and sends real payments to your review inbox every minute while the app is open.')}</p></div></div>
    {!native ? <p role="note" className="border-l-4 border-primary bg-muted p-3 text-sm">{d('smsWebOnly', 'Automatic message reading works only in the CungaCash Android app. In a browser, iPhone or desktop, paste messages in the Import tab instead.')}</p> : <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="sms-account">{d('account', 'Account')}</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger id="sms-account" className="min-h-11"><SelectValue placeholder={d('chooseAccount', 'Select an RWF account')} /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-end gap-2">
          {permission !== 'granted' || !consented
            ? <Button className="min-h-11 w-full" onClick={askPermission} disabled={consent.isPending}><ShieldCheck />{d('smsAllow', 'Allow message access')}</Button>
            : <Button variant="outline" className="min-h-11 w-full" onClick={sync} disabled={!ready || running}>{running ? <Loader2 className="animate-spin" /> : <RefreshCw />}{d('smsSyncNow', 'Check now')}</Button>}
        </div>
      </div>
      {permission === 'denied' && <p role="alert" className="text-sm text-destructive">{d('smsDenied', 'Message access was refused. Enable SMS permission for CungaCash in Android settings.')}</p>}
      {ready && <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">{([['checked', 'Checked'], ['queued', 'To review'], ['adverts', 'Adverts skipped'], ['unrelated', 'Not payments'], ['duplicates', 'Possible duplicates']] as const).map(([k, label]) => <div key={k} className="rounded-md bg-muted p-2"><dt className="text-xs text-muted-foreground">{d(`sms_${k}`, label)}</dt><dd className="font-semibold tabular-nums">{stats[k]}</dd></div>)}</dl>}
      {stats.lastRun && <p className="flex items-center gap-2 text-xs text-muted-foreground"><MessageSquareText className="size-3" />{d('smsLast', 'Last check')}: {new Date(stats.lastRun).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </>}
  </section>;
}
