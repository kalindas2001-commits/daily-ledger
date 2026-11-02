import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Link2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentMethodLogo } from '@/components/PaymentMethodLogo';
import { useCaptureEvidence, useCaptureMatches, useMoneyCapture } from '@/hooks/useMoneyCapture';
import type { Account } from '@/hooks/useAccounts';
import { canPostCapture, type CaptureCandidate, type CaptureFields } from '@/lib/capture/review';

const methods = ['MTN MOMO', 'AIRTEL MONEY', 'VISA', 'MASTERCARD', 'PAYPAL', 'BANK CHEQUE'];
type Decision = 'post' | 'match' | 'reject' | 'defer';

export default function CaptureReviewDialog({ candidate, accounts, onClose }: { candidate: CaptureCandidate; accounts: Account[]; onClose: () => void }) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`capture.${key}`);
  const [fields, setFields] = useState<CaptureFields>({
    account_id: candidate.account_id ?? '', amount_minor: candidate.amount_minor ?? 0,
    direction: candidate.direction ?? '', occurred_on: candidate.occurred_on ?? '',
    occurred_time: candidate.occurred_time ?? '', category: candidate.category ?? '',
    description: candidate.description ?? '', payment_method: candidate.provider === 'MTN MoMo' ? 'MTN MOMO' : candidate.provider === 'Airtel Money' ? 'AIRTEL MONEY' : '', payment_confirmed: false,
  });
  const [separate, setSeparate] = useState(false);
  const [matchId, setMatchId] = useState('');
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState('');
  const evidence = useCaptureEvidence(candidate);
  const matches = useCaptureMatches(fields);
  const { resolve } = useMoneyCapture('needs_review');
  const editable = ['needs_review', 'deferred'].includes(candidate.status);
  const ordinary = candidate.currency === 'RWF' && ['payment', 'fee', 'unknown'].includes(candidate.treatment);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const selectedAccount = accounts.some(account => account.id === fields.account_id);
  const valid = selectedAccount && canPostCapture(candidate, fields, today);
  const duplicates = matches.data ?? [];
  const checked = matches.isSuccess && !matches.isFetching;
  const postAllowed = valid && checked && (duplicates.length === 0 || separate);
  const matchAllowed = editable && ordinary && checked && fields.payment_confirmed && duplicates.some(row => row.id === matchId);
  function update<K extends keyof CaptureFields>(key: K, value: CaptureFields[K]) {
    setFields(previous => ({ ...previous, [key]: value, payment_confirmed: key === 'payment_confirmed' ? value === true : false }));
    setSeparate(false); setMatchId(''); setError('');
  }
  async function save() {
    if (!decision || (decision === 'post' && !postAllowed) || (decision === 'match' && !matchAllowed)) return;
    setError('');
    try {
      await resolve.mutateAsync({ candidate, action: decision, fields: { ...fields, reason }, separate, matchId: matchId || undefined });
      toast.success(tr('saved')); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('error')); setDecision(null); }
  }
  const warnings = { post: 'postWarning', match: 'matchWarning', reject: 'rejectWarning', defer: 'deferWarning' };
  return <Dialog open onOpenChange={open => { if (!open && !resolve.isPending) onClose(); }}>
    <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{tr('view')} · {candidate.provider}</DialogTitle><DialogDescription>{tr(candidate.status)} · {candidate.reference ?? tr('unknown')}</DialogDescription></DialogHeader>
      {!ordinary && <p className="border-l-4 border-destructive bg-muted p-3 text-sm">{tr('special')}</p>}
      <fieldset disabled={!editable || resolve.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="capture-account">{tr('account')}</Label><Select value={fields.account_id} onValueChange={value => update('account_id', value)}><SelectTrigger id="capture-account"><SelectValue placeholder={tr('chooseAccount')} /></SelectTrigger><SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="capture-amount">{tr('amount')}</Label><Input id="capture-amount" type="number" min="1" step="1" value={fields.amount_minor || ''} onChange={event => update('amount_minor', Number(event.target.value))} /></div>
        <div className="space-y-2"><Label htmlFor="capture-direction">{tr('direction')}</Label><Select value={fields.direction} onValueChange={value => update('direction', value)}><SelectTrigger id="capture-direction"><SelectValue placeholder={tr('direction')} /></SelectTrigger><SelectContent>{['INCOME', 'EXPENSE'].map(value => <SelectItem key={value} value={value}>{tr(value)}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="capture-date">{tr('date')}</Label><Input id="capture-date" type="date" min="2000-01-01" max={today} value={fields.occurred_on} onChange={event => update('occurred_on', event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="capture-time">{tr('time')}</Label><Input id="capture-time" type="time" value={fields.occurred_time} onChange={event => update('occurred_time', event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="capture-category">{tr('category')}</Label><Input id="capture-category" maxLength={100} value={fields.category} onChange={event => update('category', event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="capture-method">{tr('method')}</Label><Select value={fields.payment_method} onValueChange={value => update('payment_method', value)}><SelectTrigger id="capture-method"><SelectValue placeholder={tr('method')} /></SelectTrigger><SelectContent>{methods.map(method => <SelectItem key={method} value={method}><span className="flex items-center gap-3"><PaymentMethodLogo method={method} />{method}</span></SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="capture-description">{tr('description')}</Label><Textarea id="capture-description" maxLength={1000} value={fields.description} onChange={event => update('description', event.target.value)} /></div>
      </fieldset>
      <section className="border-t pt-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />{tr('evidence')}</h3>
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs font-mono">{candidate.evidence_excerpt}</pre>
        {evidence.isPending && <p role="status" className="text-sm text-muted-foreground">{tr('loading')}</p>}
        {evidence.isError && <Button variant="outline" onClick={() => evidence.refetch()}>{tr('retry')}</Button>}
        {evidence.data && <>
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><div><dt>{tr('source')}</dt><dd className="break-words text-foreground">{evidence.data.job?.file_name}</dd></div><div><dt>{tr('parser')}</dt><dd className="text-foreground">{evidence.data.job?.parser_version}</dd></div><div><dt>{tr('importTime')}</dt><dd className="text-foreground">{evidence.data.job?.created_at ? new Date(evidence.data.job.created_at).toLocaleString() : '—'}</dd></div></dl>
          <details><summary className="cursor-pointer text-sm font-medium">{tr('evidence')}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-muted p-3 text-xs">{evidence.data.evidence?.raw_text}</pre></details>
          <details><summary className="cursor-pointer text-sm font-medium">{tr('history')}</summary><ol className="mt-3 space-y-3 border-l pl-4">{evidence.data.audit?.map(event => <li key={event.id} className="text-xs"><p className="font-medium">{event.event.replace(/_/g, ' ')}</p><time className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</time><pre className="whitespace-pre-wrap break-words text-muted-foreground">{JSON.stringify(event.details)}</pre></li>)}</ol></details>
          {evidence.data.link?.transaction_id && <Button asChild variant="outline"><Link to="/transactions">{tr('transaction')}</Link></Button>}
        </>}
      </section>
      {editable && <>
        {ordinary && <section className="border-t pt-4 space-y-3">
          <h3 className="font-semibold">{tr('duplicates')}</h3>
          {matches.isFetching && <p role="status" className="text-sm text-muted-foreground">{tr('loading')}</p>}
          {matches.isError && <div role="alert" className="text-sm text-destructive">{tr('matchesError')} <Button variant="outline" onClick={() => matches.refetch()}>{tr('retry')}</Button></div>}
          {checked && duplicates.length === 0 && <p className="text-sm text-muted-foreground">{tr('noDuplicates')}</p>}
          {duplicates.map(row => <label key={row.id} className="flex items-start gap-3 border-b py-3 text-sm"><input type="radio" name="capture-match" value={row.id} checked={matchId === row.id} onChange={() => { setMatchId(row.id); setSeparate(false); }} className="mt-1" /><span className="min-w-0 break-words">{row.category} · {row.total_amount.toLocaleString()} RWF<br /><span className="text-muted-foreground">{row.transaction_date} · {row.description}</span></span></label>)}
          {duplicates.length > 0 && <label className="flex items-start gap-3 text-sm"><Checkbox checked={separate} onCheckedChange={value => { setSeparate(value === true); setMatchId(''); }} /><span>{tr('separate')}</span></label>}
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={fields.payment_confirmed} onCheckedChange={value => setFields(previous => ({ ...previous, payment_confirmed: value === true }))} /><span>{tr('verified')}</span></label>
        </section>}
        <div className="space-y-2"><Label htmlFor="capture-reason">{tr('reason')}</Label><Textarea id="capture-reason" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="h-auto min-h-11 whitespace-normal" disabled={!postAllowed || resolve.isPending} onClick={() => setDecision('post')}><Check />{tr('confirm')}</Button>
          <Button variant="outline" className="h-auto min-h-11 whitespace-normal" disabled={!matchAllowed || resolve.isPending} onClick={() => setDecision('match')}><Link2 />{tr('match')}</Button>
          <Button variant="secondary" disabled={resolve.isPending} onClick={() => setDecision('defer')}><Clock />{tr('defer')}</Button>
          <Button variant="outline" className="text-destructive" disabled={resolve.isPending} onClick={() => setDecision('reject')}><X />{tr('reject')}</Button>
        </div>
      </>}
      <AlertDialog open={decision !== null} onOpenChange={open => { if (!open && !resolve.isPending) setDecision(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{tr('warning')}</AlertDialogTitle><AlertDialogDescription>{decision ? tr(warnings[decision]) : ''}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={resolve.isPending}>{tr('cancel')}</AlertDialogCancel><Button disabled={resolve.isPending} onClick={save}>{resolve.isPending ? tr('importing') : tr(decision === 'post' ? 'confirm' : decision ?? 'confirm')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </DialogContent>
  </Dialog>;
}