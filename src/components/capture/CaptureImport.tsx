import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileUp, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMoneyCapture, type CaptureKind } from '@/hooks/useMoneyCapture';
import type { Account } from '@/hooks/useAccounts';
import { parseText, type CaptureRecord } from '@/lib/capture/parser';

export default function CaptureImport({ accounts, onImported }: { accounts: Account[]; onImported: () => void }) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`capture.${key}`);
  const { sources, consent, register } = useMoneyCapture('needs_review');
  const [kind, setKind] = useState<CaptureKind>('sms');
  const [accountId, setAccountId] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ text: string; records: CaptureRecord[] } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const enabled = sources.data?.some(source => source.kind === kind && source.enabled && source.consented_at);
  const busy = processing || register.isPending || consent.isPending;
  const accountValid = accounts.some(account => account.id === accountId);
  async function prepare() {
    if (!enabled || !accountValid || busy) return;
    setProcessing(true); setError(''); setPreview(null);
    try {
      let result: { text: string; records: CaptureRecord[] };
      if (kind === 'sms') {
        if (new TextEncoder().encode(text).length > 1_000_000) throw new Error(tr('importLimit'));
        result = { text, records: parseText(text) };
      } else {
        if (!file) return;
        const { readCaptureFile } = await import('@/lib/capture/readers');
        result = await readCaptureFile(file, () => {});
      }
      if (!result.records.length || result.records.length > 200) throw new Error(tr('importLimit'));
      setPreview(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('error')); }
    finally { setProcessing(false); }
  }
  async function save() {
    if (!preview || !enabled || !accountValid || busy) return;
    setError('');
    try {
      await register.mutateAsync({ kind, accountId, text: preview.text, records: preview.records, name: kind === 'sms' ? tr('sms') : file?.name ?? tr(kind) });
      setPreview(null); setText(''); setFile(null); if (fileInput.current) fileInput.current.value = '';
      toast.success(tr('imported')); onImported();
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('error')); }
  }
  return <div className="space-y-6 max-w-3xl">
    {!accounts.length && <div className="flex flex-wrap items-center gap-3 border-l-4 border-primary bg-muted p-4"><p className="text-sm">{tr('noAccounts')}</p><Button asChild variant="outline"><Link to="/accounts">{tr('accounts')}</Link></Button></div>}
    <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="capture-source">{tr('source')}</Label><Select value={kind} onValueChange={value => { setKind(value as CaptureKind); setPreview(null); setFile(null); setError(''); if (fileInput.current) fileInput.current.value = ''; }}><SelectTrigger id="capture-source"><SelectValue /></SelectTrigger><SelectContent>{(['sms', 'document', 'statement'] as const).map(value => <SelectItem value={value} key={value}>{tr(value)}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="import-account">{tr('account')}</Label><Select value={accountId} onValueChange={value => { setAccountId(value); setPreview(null); }}><SelectTrigger id="import-account"><SelectValue placeholder={tr('chooseAccount')} /></SelectTrigger><SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="sm:col-span-2 border-y py-4 space-y-3"><h3 className="font-medium flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />{tr('sources')}</h3>
        {sources.isPending ? <p role="status">{tr('loading')}</p> : sources.isError ? <div role="alert"><p>{tr('permissionsError')}</p><Button variant="outline" onClick={() => sources.refetch()}>{tr('retry')}</Button></div> : <label className="flex items-start gap-3 text-sm"><Checkbox checked={!!enabled} disabled={consent.isPending} onCheckedChange={async value => { try { await consent.mutateAsync({ kind, enabled: value === true }); toast.success(tr(value === true ? 'granted' : 'revoked')); } catch { setError(tr('error')); } }} /><span>{tr('consent')}</span></label>}
      </div>
      {kind === 'sms' ? <div className="space-y-2 sm:col-span-2"><Label htmlFor="capture-text">{tr('text')}</Label><Textarea id="capture-text" className="min-h-48" value={text} onChange={event => { setText(event.target.value); setPreview(null); }} /></div> : <div className="space-y-3 sm:col-span-2"><Label htmlFor="capture-file">{tr('file')}</Label><input ref={fileInput} id="capture-file" type="file" accept=".txt,.csv,.xlsx,.pdf,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={event => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(''); }} /><Button variant="outline" className="min-h-11" onClick={() => fileInput.current?.click()}><FileUp />{tr('upload')}</Button><p className="text-sm text-muted-foreground break-words">{file?.name ?? 'TXT · CSV · XLSX · PDF · JPG · PNG · WEBP · 10 MB'}</p></div>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
    <Button className="min-h-11" disabled={busy || !enabled || !accountValid || (kind === 'sms' ? !text.trim() : !file)} onClick={prepare}>{processing ? <Loader2 className="animate-spin" /> : <Upload />}{processing ? tr('importing') : tr('reviewImport')}</Button>
    {preview && <section className="border-t pt-5 space-y-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{tr('preview')} ({preview.records.length})</h3><p className="text-sm text-muted-foreground">{tr('noPost')}</p></div><ul className="max-h-80 overflow-auto divide-y rounded-md border">{preview.records.map((record, index) => <li key={index} className="p-4 space-y-2"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{record.provider} · {record.direction ? tr(record.direction) : tr('unknown')}</span><span className="font-semibold tabular-nums">{record.amount_minor?.toLocaleString() ?? '—'} {record.currency}</span></div><p className="text-xs text-muted-foreground break-words">{record.occurred_on ?? tr('unknown')} · {record.reference ?? tr('unknown')}</p><p className="text-sm break-words line-clamp-2">{record.description}</p><span className="text-xs text-muted-foreground">{tr('needs_review')}</span></li>)}</ul><Button className="min-h-11 h-auto whitespace-normal" onClick={save} disabled={busy || !enabled || !accountValid}>{register.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{register.isPending ? tr('importing') : tr('register')}</Button></section>}
  </div>;
}