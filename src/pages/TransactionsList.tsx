import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Search, Pencil, Eye, MessageSquare, RefreshCw } from 'lucide-react';
import { useTransactions, useDeleteTransaction, useUpdateTransaction, useCategories } from '@/hooks/useTransactions';
import { useMyEditRequests, useMyEditRequestAlerts, formatNoteStamp, useTenantTransactions } from '@/hooks/useEditRequests';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TransactionDetailDialog from '@/components/TransactionDetailDialog';

import { PAYMENT_METHODS, PaymentMethodOption, PaymentMethodLogo } from '@/components/PaymentMethodLogo';

const safeDateLabel = (value: unknown, pattern: string, fallback = 'Date unavailable') => {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : format(parsed, pattern);
};

const safeTimeLabel = (value: unknown) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hour = Number(match[1]);
  if (hour > 23) return '';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${match[2]} ${suffix}`;
};

export default function TransactionsList() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canSeeTeam = isAdmin || isSuperAdmin;
  const [scope, setScope] = useState<'MINE' | 'TEAM'>('MINE');
  const teamMode = canSeeTeam && scope === 'TEAM';

  const { data: myTxRaw, isLoading: myLoading, error: myError, refetch: refetchMine } = useTransactions();
  const { data: teamTxRaw, isLoading: teamLoading, error: teamError, refetch: refetchTeam } = useTenantTransactions(undefined, teamMode);

  const normalizeTx = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.transactions)) return payload.transactions;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Unexpected transactions payload shape', payload);
    }
    return [];
  };

  const transactions = teamMode ? normalizeTx(teamTxRaw) : normalizeTx(myTxRaw);
  const isLoading = teamMode ? teamLoading : myLoading;
  const error: any = teamMode ? teamError : myError;

  const { data: categories } = useCategories();
  const deleteTx = useDeleteTransaction();
  const updateTx = useUpdateTransaction();
  const { data: myRequests } = useMyEditRequests();
  useMyEditRequestAlerts();


  // Latest admin note per transaction (with timestamp) for inline badges
  const noteByTx = useMemo(() => {
    const map: Record<string, any> = {};
    (myRequests ?? []).forEach((r: any) => {
      if (!r.admin_notes) return;
      if (!map[r.transaction_id]) map[r.transaction_id] = r;
    });
    return map;
  }, [myRequests]);


  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editType, setEditType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editUnitPrice, setEditUnitPrice] = useState(0);
  const [editPayment, setEditPayment] = useState('Cash');

  // Detail dialog
  const [detailTx, setDetailTx] = useState<any | null>(null);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx: any) => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterCategory !== 'ALL' && tx.category !== filterCategory) return false;
      if (filterPayment !== 'ALL' && (tx.payment_method || '') !== filterPayment) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${tx.category ?? ''} ${tx.subcategory ?? ''} ${tx.description ?? ''} ${tx.merchant_name ?? ''} ${tx.notes ?? ''} ${tx.full_name ?? ''} ${tx.email ?? ''} ${tx.id ?? ''}`;
        return hay.toLowerCase().includes(q);
      }
      return true;
    });
  }, [transactions, search, filterType, filterCategory, filterPayment]);


  const uniquePayments = useMemo(() => {
    const set = new Set(transactions?.map((t) => t.payment_method).filter(Boolean) ?? []);
    return Array.from(set) as string[];
  }, [transactions]);

  const openEdit = (tx: any) => {
    setEditId(tx.id);
    setEditType(tx.type);
    setEditDate(tx.transaction_date);
    setEditCategory(tx.category);
    setEditDescription(tx.description || '');
    setEditQuantity(tx.quantity ?? 1);
    setEditUnitPrice(tx.unit_price);
    setEditPayment(tx.payment_method || 'Cash');
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    try {
      await updateTx.mutateAsync({
        id: editId,
        type: editType,
        transaction_date: editDate,
        category: editCategory,
        description: editDescription || undefined,
        quantity: editQuantity,
        unit_price: editUnitPrice,
        payment_method: editPayment,
      });
      toast.success('Transaction updated');
      setEditOpen(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteTx.mutateAsync(id); toast.success('Transaction deleted'); }
    catch (err: any) { toast.error(err.message); }
  };

  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { minimumFractionDigits: 0 });
  const editFilteredCats = categories?.filter((c) => c.type === editType) ?? [];

  // Virtual scrolling — smooth with thousands of records
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 104,
    overscan: 12,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();




  return (
    <div className="space-y-4 pb-4">
      {canSeeTeam && (
        <div className="flex rounded-lg border overflow-hidden w-full sm:w-auto sm:inline-flex">
          {([['MINE', 'My records'], ['TEAM', isSuperAdmin ? 'All platform records' : 'Team records']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setScope(v as 'MINE' | 'TEAM')}
              className={cn(
                'flex-1 px-4 py-2 text-xs sm:text-sm font-medium transition-colors',
                scope === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Payments</SelectItem>
                {uniquePayments.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b p-3 sm:p-4 space-y-0 bg-card">
          <CardTitle className="text-sm sm:text-base flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate">{teamMode ? 'Team transactions' : 'Transactions'} ({filtered.length})</span>
            <div className="flex items-center gap-3 text-xs sm:text-sm font-normal">
              <span className="text-income truncate">+{fmt(filtered.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.total_amount ?? 0), 0))} RWF</span>
              <span className="text-expense truncate">-{fmt(filtered.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.total_amount ?? 0), 0))} RWF</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 bg-card text-card-foreground min-h-[220px]">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Could not load transactions</p>
              <p className="max-w-md text-xs text-muted-foreground">{error.message ?? 'Unexpected error'}</p>
              <Button variant="outline" size="sm" onClick={() => teamMode ? refetchTeam() : refetchMine()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-live="polite">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                  <div className="h-7 w-7 rounded-md bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-2/3 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                </div>
              ))}
              <p className="pt-1 text-center text-xs text-muted-foreground">Loading transactions…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 py-10 text-center">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No transactions found</p>
              <p className="text-xs text-muted-foreground">Adjust your filters or add a new transaction to get started.</p>
            </div>
          ) : (

            <div ref={scrollRef} className="max-h-[70vh] min-h-[140px] overflow-y-auto bg-card">
              <div className="relative" style={{ height: `${Math.max(rowVirtualizer.getTotalSize(), 96)}px` }}>
                {(virtualRows.length > 0
                  ? virtualRows
                  : filtered.slice(0, 20).map((_, index) => ({ index, key: index, start: index * 96 } as any))
                ).map((vi) => {
                  const tx: any = filtered[vi.index];
                  if (!tx) return null;
                  const note = noteByTx[tx.id];
                  return (
                    <div
                      key={tx.id ?? vi.index}
                      ref={virtualRows.length > 0 ? rowVirtualizer.measureElement : undefined}
                      data-index={vi.index}
                      className="absolute left-0 top-0 w-full bg-card text-card-foreground"
                      style={{ transform: `translateY(${vi.start}px)` }}
                    >
                      <div
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-2 py-3 px-1.5 sm:px-3 border-b sm:border-b-0 sm:rounded-lg hover:bg-muted/60 transition-col[...]
                        onClick={() => setDetailTx(tx)}
                      >
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <PaymentMethodLogo method={tx.payment_method} size={26} />
                          <span className={cn('w-2 h-2 rounded-full shrink-0', tx.type === 'INCOME' ? 'bg-income' : 'bg-expense')} />
                        </div>


                        <div className="min-w-0">
                          <p className="text-sm font-medium break-words leading-snug">
                            {tx.category}
                            {tx.subcategory && <span className="text-muted-foreground"> · {tx.subcategory}</span>}
                          </p>
                          <p className="text-[11px] sm:text-xs text-muted-foreground break-words leading-snug mt-0.5">
                            {safeDateLabel(tx.transaction_date, 'MMM d, yyyy')}
                            {safeTimeLabel(tx.transaction_time) && ` · ${safeTimeLabel(tx.transaction_time)}`}
                            {tx.payment_method ? ` · ${tx.payment_method}` : ''}
                            {tx.merchant_name && ` · ${tx.merchant_name}`}
                            {tx.description && ` · ${tx.description}`}
                          </p>
                          {teamMode && (
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                              {tx.full_name || tx.email || 'Team member'}
                            </p>
                          )}
                          {note && (
                            <span
                              className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium"
                              title={note.admin_notes ?? ''}
                            >
                              <MessageSquare className="w-3 h-3 shrink-0" />
                              <span className="truncate">Admin note · {formatNoteStamp(note.reviewed_at ?? note.updated_at ?? note.created_at)}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <p className={cn('text-sm font-semibold whitespace-nowrap', tx.type === 'INCOME' ? 'text-income' : 'text-expense')}>
                            {tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.total_amount ?? 0)}
                            <span className="text-[10px] font-normal text-muted-foreground"> RWF</span>
                          </p>
                          {(tx.quantity ?? 1) > 1 && (
                            <p className="text-[10px] text-muted-foreground">{tx.quantity} × {fmt(tx.unit_price)}</p>
                          )}
                        </div>

                        <div
                          className="col-span-3 flex items-center justify-end gap-0.5 -mt-1 sm:mt-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailTx(tx)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!teamMode && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => openEdit(tx)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive sm:opacity-0 sm:group-hover:opacity-100" onClick={() => handleDelete(tx.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      <TransactionDetailDialog open={!!detailTx} onOpenChange={(o) => !o && setDetailTx(null)} tx={detailTx} />

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex rounded-lg overflow-hidden border">
              {(['INCOME', 'EXPENSE'] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setEditType(t); setEditCategory(''); }}
                  className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                    editType === t ? (t === 'INCOME' ? 'bg-income text-primary-foreground' : 'bg-expense text-primary-foreground') : 'bg-secondary text-secondary-foreground'
                  )}>{t}</button>
              ))}
            </div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></div>
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{editFilteredCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" min={1} value={editQuantity} onChange={(e) => setEditQuantity(Math.max(1, +e.target.value))} /></div>
              <div className="space-y-1"><Label>Unit Price (RWF)</Label><Input type="number" min={0} value={editUnitPrice || ''} onChange={(e) => setEditUnitPrice(+e.target.value)} /></div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className={cn('text-xl font-bold', editType === 'INCOME' ? 'text-income' : 'text-expense')}>
                {(editQuantity * editUnitPrice).toLocaleString('en-RW')} RWF
              </p>
            </div>
            <Select value={editPayment} onValueChange={setEditPayment}>
              <SelectTrigger>
                <span className="flex items-center gap-2 truncate"><PaymentMethodLogo method={editPayment} size={20} />{editPayment}</span>
              </SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}><PaymentMethodOption method={m} /></SelectItem>)}</SelectContent>
            </Select>

            <Textarea placeholder="Description (optional)" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateTx.isLoading}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
