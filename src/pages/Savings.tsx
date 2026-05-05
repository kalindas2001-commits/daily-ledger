import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PiggyBank, Plus, ArrowDownCircle, ArrowUpCircle, FileText, Trash2, Receipt } from 'lucide-react';
import { useSavingsAccounts, useSavingsTransactions, useCreateSavingsAccount, useDeleteSavingsAccount, useCreateSavingsTx } from '@/hooks/useSavings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { generateReceiptPDF, formatCurrency as fmt } from '@/lib/receipt';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SavingsPage() {
  const { user } = useAuth();
  const { data: accounts, isLoading } = useSavingsAccounts();
  const createAcc = useCreateSavingsAccount();
  const deleteAcc = useDeleteSavingsAccount();
  const createTx = useCreateSavingsTx();

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => accounts?.find(a => a.id === activeId) ?? accounts?.[0] ?? null, [accounts, activeId]);
  const { data: txs } = useSavingsTransactions(active?.id);

  // dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState<null | 'DEPOSIT' | 'WITHDRAW'>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // form
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState('');

  const totalSavings = useMemo(() => accounts?.reduce((s, a) => s + Number(a.current_balance), 0) ?? 0, [accounts]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Enter a name'); return; }
    try {
      await createAcc.mutateAsync({ name: name.trim(), goal_amount: goal });
      toast.success('Savings account created');
      setCreateOpen(false); setName(''); setGoal(0);
    } catch (e: any) { toast.error(e.message); }
  };

  const submitAction = async () => {
    if (!active || !actionOpen || amount <= 0) { toast.error('Enter valid amount'); return; }
    if (actionOpen === 'WITHDRAW' && Number(amount) > Number(active.current_balance)) {
      toast.error('Insufficient balance'); return;
    }
    try {
      const tx = await createTx.mutateAsync({ account_id: active.id, action: actionOpen, amount, note });
      // Generate receipt
      const profile = await supabase.from('profiles').select('full_name').eq('user_id', user!.id).maybeSingle();
      const customerName = profile.data?.full_name || user!.email!.split('@')[0];
      const newBalance = Number(active.current_balance) + (actionOpen === 'DEPOSIT' ? Number(amount) : -Number(amount));
      generateReceiptPDF({
        title: actionOpen === 'DEPOSIT' ? 'Savings Deposit Receipt' : 'Savings Withdrawal Receipt',
        receiptNo: tx.receipt_no,
        occurredAt: tx.occurred_at,
        customerName,
        customerEmail: user!.email!,
        rows: [
          { label: 'Account', value: active.name },
          { label: 'Action', value: actionOpen === 'DEPOSIT' ? 'Deposit (Credit)' : 'Withdrawal (Debit)' },
          { label: 'Amount', value: `${fmt(amount)} RWF`, emphasize: true },
          { label: 'Previous Balance', value: `${fmt(Number(active.current_balance))} RWF` },
          { label: 'New Balance', value: `${fmt(newBalance)} RWF`, emphasize: true },
          ...(note ? [{ label: 'Note', value: note }] : []),
        ],
        footerNote: 'This receipt is system-generated and serves as proof of the transaction.',
      });
      toast.success(`${actionOpen === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} recorded — receipt downloaded`);
      setActionOpen(null); setConfirmOpen(false); setAmount(0); setNote('');
    } catch (e: any) { toast.error(e.message); }
  };

  const reprintReceipt = async (tx: any) => {
    const profile = await supabase.from('profiles').select('full_name').eq('user_id', user!.id).maybeSingle();
    const customerName = profile.data?.full_name || user!.email!.split('@')[0];
    generateReceiptPDF({
      title: tx.action === 'DEPOSIT' ? 'Savings Deposit Receipt' : 'Savings Withdrawal Receipt',
      receiptNo: tx.receipt_no,
      occurredAt: tx.occurred_at,
      customerName,
      customerEmail: user!.email!,
      rows: [
        { label: 'Account', value: active!.name },
        { label: 'Action', value: tx.action === 'DEPOSIT' ? 'Deposit (Credit)' : 'Withdrawal (Debit)' },
        { label: 'Amount', value: `${fmt(tx.amount)} RWF`, emphasize: true },
        ...(tx.note ? [{ label: 'Note', value: tx.note }] : []),
      ],
      footerNote: 'Re-printed copy.',
    });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <PiggyBank className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Savings</p>
            <p className="text-2xl font-bold text-primary">{fmt(totalSavings)} RWF</p>
            <p className="text-xs text-muted-foreground">{accounts?.length ?? 0} account{(accounts?.length ?? 0) !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> New</Button>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-center text-muted-foreground py-8">Loading…</p> :
       accounts?.length === 0 ? (
        <Card><CardContent className="py-12 text-center space-y-2">
          <PiggyBank className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No savings accounts yet</p>
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Create your first savings</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Accounts list */}
          <div className="space-y-2">
            {accounts!.map(a => {
              const pct = a.goal_amount > 0 ? Math.min(100, (Number(a.current_balance) / Number(a.goal_amount)) * 100) : 0;
              const isActive = active?.id === a.id;
              return (
                <button key={a.id} onClick={() => setActiveId(a.id)}
                  className={cn('w-full text-left p-4 rounded-xl border transition-all',
                    isActive ? 'bg-primary/5 border-primary shadow-sm' : 'bg-card hover:bg-muted/40')}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{a.name}</span>
                    {a.goal_amount > 0 && <Badge variant="outline" className="text-[10px]">{pct.toFixed(0)}%</Badge>}
                  </div>
                  <p className="text-lg font-bold text-primary mt-1">{fmt(Number(a.current_balance))} RWF</p>
                  {a.goal_amount > 0 && (
                    <>
                      <Progress value={pct} className="h-1.5 mt-2" />
                      <p className="text-[10px] text-muted-foreground mt-1">Goal: {fmt(Number(a.goal_amount))} RWF</p>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active account detail */}
          {active && (
            <div className="lg:col-span-2 space-y-3">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{active.name}</CardTitle>
                      <p className="text-3xl font-bold text-primary mt-1">{fmt(Number(active.current_balance))} RWF</p>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive"
                      onClick={() => { if (confirm(`Delete "${active.name}" and all its history?`)) deleteAcc.mutate(active.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => { setActionOpen('DEPOSIT'); setAmount(0); setNote(''); }} className="bg-income hover:bg-income/90">
                      <ArrowDownCircle className="w-4 h-4 mr-2" /> Deposit
                    </Button>
                    <Button onClick={() => { setActionOpen('WITHDRAW'); setAmount(0); setNote(''); }} variant="outline" className="border-expense text-expense hover:bg-expense/10">
                      <ArrowUpCircle className="w-4 h-4 mr-2" /> Withdraw
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Transaction History</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {!txs || txs.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No transactions yet</p> :
                    txs.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                            t.action === 'DEPOSIT' ? 'bg-income/15 text-income' : 'bg-expense/15 text-expense')}>
                            {t.action === 'DEPOSIT' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{t.action === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(t.occurred_at), 'MMM d, yyyy · HH:mm')} · #{t.receipt_no}
                            </p>
                            {t.note && <p className="text-[11px] text-muted-foreground italic truncate">{t.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn('font-bold text-sm', t.action === 'DEPOSIT' ? 'text-income' : 'text-expense')}>
                            {t.action === 'DEPOSIT' ? '+' : '-'}{fmt(Number(t.amount))}
                          </span>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reprintReceipt(t)} title="Re-print receipt">
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Create account dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Savings Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Emergency Fund" /></div>
            <div><Label>Goal amount (optional, RWF)</Label><Input type="number" min={0} value={goal || ''} onChange={e => setGoal(+e.target.value)} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createAcc.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit/Withdraw dialog */}
      <Dialog open={!!actionOpen} onOpenChange={(o) => { if (!o) setActionOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionOpen === 'DEPOSIT' ? <ArrowDownCircle className="text-income w-5 h-5" /> : <ArrowUpCircle className="text-expense w-5 h-5" />}
              {actionOpen === 'DEPOSIT' ? 'Deposit to Savings' : 'Withdraw from Savings'}
            </DialogTitle>
            <DialogDescription>
              {actionOpen === 'DEPOSIT'
                ? 'This deposit will increase your savings balance and is recorded as outgoing cash from your wallet (treated as an internal transfer for accounting).'
                : 'This withdrawal will decrease your savings balance and the funds are returned to your wallet (treated as an internal transfer).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm bg-muted p-3 rounded-lg">
              <p className="text-muted-foreground">Current balance</p>
              <p className="font-bold text-lg">{fmt(Number(active?.current_balance ?? 0))} RWF</p>
            </div>
            <div><Label>Amount (RWF)</Label><Input type="number" min={0} value={amount || ''} onChange={e => setAmount(+e.target.value)} autoFocus /></div>
            <div><Label>Note (optional)</Label><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason / source / etc." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(null)}>Cancel</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={amount <= 0}
              className={actionOpen === 'DEPOSIT' ? 'bg-income hover:bg-income/90' : 'bg-expense hover:bg-expense/90'}>
              <FileText className="w-4 h-4 mr-1" /> Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {actionOpen === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</DialogTitle>
            <DialogDescription>
              You are about to {actionOpen === 'DEPOSIT' ? 'add' : 'withdraw'} <strong>{fmt(amount)} RWF</strong>{' '}
              {actionOpen === 'DEPOSIT' ? 'to' : 'from'} <strong>{active?.name}</strong>. A receipt PDF will be generated automatically and can be re-downloaded later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={submitAction} disabled={createTx.isPending}>Confirm & Generate Receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
