import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSearch, Inbox, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccounts } from '@/hooks/useAccounts';
import { useMoneyCapture } from '@/hooks/useMoneyCapture';
import type { CaptureCandidate } from '@/lib/capture/review';
import CaptureImport from '@/components/capture/CaptureImport';
import CaptureReviewDialog from '@/components/capture/CaptureReviewDialog';

export default function MoneyCapture() {
  const { t } = useTranslation();
  const tr = (key: string) => t(`capture.${key}`);
  const [tab, setTab] = useState('inbox');
  const [status, setStatus] = useState('needs_review');
  const [selected, setSelected] = useState<CaptureCandidate | null>(null);
  const accounts = useAccounts();
  const activeAccounts = (accounts.data ?? []).filter(account => account.currency === 'RWF' && !account.is_archived);
  const { inbox } = useMoneyCapture(status);
  const records = inbox.data?.pages.flat() ?? [];
  return <div className="mx-auto max-w-6xl space-y-6 text-foreground">
    <div className="flex items-center gap-3"><FileSearch className="size-8 shrink-0 text-primary" /><h2 className="text-2xl font-bold break-words">{tr('title')}</h2></div>
    {accounts.isError && <div role="alert" className="flex flex-wrap items-center gap-3 border-l-4 border-destructive bg-muted p-4"><p className="text-sm">{tr('accountError')}</p><Button variant="outline" onClick={() => accounts.refetch()}><RefreshCw />{tr('retry')}</Button></div>}
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-5 h-auto min-h-11"><TabsTrigger value="inbox" className="min-h-10 gap-2"><Inbox className="size-4" />{tr('inbox')}</TabsTrigger><TabsTrigger value="import" className="min-h-10 gap-2"><Plus className="size-4" />{tr('import')}</TabsTrigger></TabsList>
      <TabsContent value="import"><CaptureImport accounts={activeAccounts} onImported={() => { setStatus('needs_review'); setTab('inbox'); }} /></TabsContent>
      <TabsContent value="inbox" className="space-y-4">
        <div className="flex items-center justify-between gap-3"><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label={tr('inbox')} className="w-full max-w-64 min-h-11"><SelectValue /></SelectTrigger><SelectContent>{['needs_review', 'deferred', 'posted', 'duplicate_linked', 'rejected', 'all'].map(value => <SelectItem key={value} value={value}>{tr(value)}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={tr('retry')} title={tr('retry')} onClick={() => inbox.refetch()} disabled={inbox.isFetching}><RefreshCw className={inbox.isFetching ? 'animate-spin' : ''} /></Button></div>
        {inbox.isPending ? <div role="status" className="space-y-3"><p className="text-sm text-muted-foreground">{tr('loading')}</p>{[1, 2, 3].map(value => <div key={value} className="h-24 animate-pulse rounded-md bg-muted" />)}</div> : inbox.isError ? <div role="alert" className="border-l-4 border-destructive bg-muted p-4 space-y-3"><p>{tr('error')}</p><Button onClick={() => inbox.refetch()} variant="outline">{tr('retry')}</Button></div> : !records.length ? <div className="flex flex-col items-center gap-4 py-16 text-center"><Inbox className="size-12 text-muted-foreground" /><h3 className="text-lg font-semibold">{tr(status === 'needs_review' ? 'emptyReview' : 'empty')}</h3><Button onClick={() => setTab('import')}><Plus />{tr('import')}</Button></div> : <ul className="divide-y border-y">{records.map(record => <li key={record.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{record.provider}</span><span className="rounded-sm bg-muted px-2 py-1 text-xs font-medium">{tr(record.status)}</span></div><p className="text-sm break-words line-clamp-2">{record.description || record.evidence_excerpt}</p><p className="text-xs text-muted-foreground break-words">{record.occurred_on ?? tr('unknown')} · {record.reference ?? tr('unknown')}</p></div><div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end"><span className="font-semibold tabular-nums">{record.direction === 'EXPENSE' ? '−' : record.direction === 'INCOME' ? '+' : ''}{record.amount_minor?.toLocaleString() ?? '—'} {record.currency}</span><Button variant="outline" className="min-h-11" onClick={() => setSelected(record)}><FileSearch />{tr('view')}</Button></div></li>)}</ul>}
        {inbox.hasNextPage && <Button variant="outline" className="min-h-11" disabled={inbox.isFetchingNextPage} onClick={() => inbox.fetchNextPage()}>{inbox.isFetchingNextPage ? tr('loading') : tr('more')}</Button>}
      </TabsContent>
    </Tabs>
    {selected && <CaptureReviewDialog key={selected.id} candidate={selected} accounts={activeAccounts} onClose={() => setSelected(null)} />}
  </div>;
}