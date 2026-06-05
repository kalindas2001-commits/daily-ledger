import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, HandCoins, Wallet, PlusCircle, CheckCircle2, Coins, Eye, Receipt } from 'lucide-react';
import { useLoans, useCreateLoan, useDeleteLoan } from '@/hooks/useLoans';
import { useCreateLoanTx, useLoanTransactions } from '@/hooks/useLoanTx';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { generateReceiptPDF, formatCurrency as fmt } from '@/lib/receipt';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ActionKind = 'ADD' | 'FULL_REPAY' | 'PARTIAL';

export default function Loans() {
  const { user } = useAuth();
  const { data: loans, isLoading } = useLoans();
  const createLoan = useCreateLoan();
  const deleteLoan = useDeleteLoan();
  const createTx = useCreateLoanTx();

  const [addOpen, setAddOpen] = useState(false);
  const [loanType, setLoanType] = useState<'GIVEN' | 'RECEIVED'>('GIVEN');
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [loanDate, setLoanDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusTab, setStatusTab] = useState('PENDING');

  // Detail / actions
  const [activeLoan, setActiveLoan] = useState<any>(null);
  const [actionKind, setActionKind] = useState<ActionKind | null>(null);
  const [actAmount, setActAmount] = useState<number>(0);
  const [actNote, setActNote] = useState('');
  const { data: history } = useLoanTransactions(activeLoan?.id);

  const givenList = useMemo(() => loans?.filter(l => l.type === 'GIVEN' && l.status === statusTab) ?? [], [loans, statusTab]);
  const receivedList = useMemo(() => loans?.filter(l => l.type === 'RECEIVED' && l.status === statusTab) ?? [], [loans, statusTab]);
  const totalGivenPending = useMemo(() => loans?.filter(l => l.type === 'GIVEN' && l.status === 'PENDING').reduce((s, l) => s + Number(l.amount), 0) ?? 0, [loans]);
  const totalReceivedPending = useMemo(() => loans?.filter(l => l.type === 'RECEIVED' && l.status === 'PENDING').reduce((s, l) => s + Number(l.amount), 0) ?? 0, [loans]);

  const handleCreate = async () => {
    if (!personName.trim() || amount <= 0) { toast.error('Fill name and amount'); return; }
    try {
      await createLoan.mutateAsync({ person_name: personName.trim(), amount, type: loanType, description: description || undefined, loan_date: loanDate });
      toast.success('Loan created');
      setAddOpen(false); setPersonName(''); setAmount(0); setDescription('');
    } catch (e: any) { toast.error(e.message); }
  };

  const submitAction = async () => {
    if (!activeLoan || !actionKind) return;
    if (actionKind !== 'FULL_REPAY' && actAmount <= 0) { toast.error('Enter a valid amount'); return; }
    const useAmount = actionKind === 'FULL_REPAY' ? Number(activeLoan.amount) : actAmount;
    try {
      const tx = await createTx.mutateAsync({ loan_id: activeLoan.id, action: actionKind, amount: useAmount, note: actNote });
      const profile = await supabase.from('profiles').select('full_name').eq('user_id', user!.id).maybeSingle();
      const customerName = profile.data?.full_name || user!.email!.split('@')[0];
      const titleMap = { ADD: 'Loan Increase Receipt', FULL_REPAY: 'Loan Full Repayment Receipt', PARTIAL: 'Loan Partial Payment Receipt' };
      generateReceiptPDF({
        title: titleMap[actionKind],
        receiptNo: tx.receipt_no,
        occurredAt: tx.occurred_at,
        customerName,
        customerEmail: user!.email!,
        rows: [
          { label: 'Counterparty', value: activeLoan.person_name },
          { label: 'Loan type', value: activeLoan.type === 'GIVEN' ? 'Given (they owe me)' : 'Received (I owe)' },
          { label: 'Action', value: actionKind === 'ADD' ? 'Add to loan' : actionKind === 'FULL_REPAY' ? 'Full repayment' : 'Partial payment' },
          { label: 'Amount', value: `${fmt(useAmount)} RWF`, emphasize: true },
          { label: 'Previous outstanding', value: `${fmt(Number(activeLoan.amount))} RWF` },
          ...(actNote ? [{ label: 'Note', value: actNote }] : []),
        ],
      });
      toast.success('Recorded — receipt downloaded');
      setActionKind(null); setActAmount(0); setActNote('');
      // refresh active loan
      const refreshed = (await supabase.from('loans').select('*').eq('id', activeLoan.id).maybeSingle()).data;
      if (refreshed) setActiveLoan(refreshed);
    } catch (e: any) { toast.error(e.message); }
  };

  const LoanCard = ({ loan }: { loan: any }) => (
    <button onClick={() => setActiveLoan(loan)} className="w-full text-left flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm">{loan.person_name}</p>
          {loan.status === 'PAID' && <Badge variant="secondary" className="text-[10px]">Paid</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(loan.loan_date), 'MMM d, yyyy')}
          {loan.created_at && ` · ${format(new Date(loan.created_at), 'h:mm a')}`}
          {loan.description && ` · ${loan.description}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('font-bold text-sm', loan.type === 'GIVEN' ? 'text-expense' : 'text-income')}>
          {fmt(Number(loan.amount))} RWF
        </span>
        <Eye className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  );

  const actionDescriptions: Record<ActionKind, string> = {
    ADD: 'This amount will be ADDED on top of the existing total loan. The outstanding balance will increase. A receipt will be generated.',
    FULL_REPAY: 'This will mark the ENTIRE outstanding balance as paid in full. The loan status will become PAID. A receipt will be generated.',
    PARTIAL: 'You are recording a partial/random amount paid (not the exact full amount). The outstanding balance will be reduced by this amount. A receipt will be generated.',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-expense/20"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-expense/10 flex items-center justify-center"><HandCoins className="w-5 h-5 text-expense" /></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">People Owe Me</p>
            <p className="text-lg font-bold text-expense">{fmt(totalGivenPending)} RWF</p></div>
        </CardContent></Card>
        <Card className="border-income/20"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-income/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-income" /></div>
          <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">I Owe People</p>
            <p className="text-lg font-bold text-income">{fmt(totalReceivedPending)} RWF</p></div>
        </CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList><TabsTrigger value="PENDING">Pending</TabsTrigger><TabsTrigger value="PAID">Paid</TabsTrigger></TabsList>
        </Tabs>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Loan</Button>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HandCoins className="w-4 h-4 text-expense" /> People Owe Me</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <p className="text-center text-muted-foreground py-4">Loading…</p> :
            givenList.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No loans</p> :
            givenList.map(l => <LoanCard key={l.id} loan={l} />)}
        </CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-income" /> I Owe People</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <p className="text-center text-muted-foreground py-4">Loading…</p> :
            receivedList.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No loans</p> :
            receivedList.map(l => <LoanCard key={l.id} loan={l} />)}
        </CardContent></Card>

      {/* Add Loan Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex rounded-lg overflow-hidden border">
              {(['GIVEN', 'RECEIVED'] as const).map(t => (
                <button key={t} type="button" onClick={() => setLoanType(t)}
                  className={cn('flex-1 py-2.5 text-sm font-medium transition-colors',
                    loanType === t ? (t === 'GIVEN' ? 'bg-expense text-primary-foreground' : 'bg-income text-primary-foreground') : 'bg-secondary text-secondary-foreground'
                  )}>{t === 'GIVEN' ? 'I Gave (Lent)' : 'I Received (Borrowed)'}</button>
              ))}
            </div>
            <div className="space-y-1"><Label>Person Name</Label><Input value={personName} onChange={e => setPersonName(e.target.value)} autoFocus /></div>
            <div className="space-y-1"><Label>Amount (RWF)</Label><Input type="number" min={0} value={amount || ''} onChange={e => setAmount(+e.target.value)} /></div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} /></div>
            <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLoan.isPending}>Save Loan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan detail dialog */}
      <Dialog open={!!activeLoan} onOpenChange={(o) => { if (!o) { setActiveLoan(null); setActionKind(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {activeLoan && (
            <>
              <DialogHeader><DialogTitle>{activeLoan.person_name}</DialogTitle>
                <DialogDescription>
                  {activeLoan.type === 'GIVEN' ? 'They owe you' : 'You owe them'} · Started {format(new Date(activeLoan.loan_date), 'MMM d, yyyy')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Outstanding balance</p>
                      <p className={cn('text-3xl font-bold', activeLoan.type === 'GIVEN' ? 'text-expense' : 'text-income')}>{fmt(Number(activeLoan.amount))} RWF</p>
                      {activeLoan.original_amount && Number(activeLoan.original_amount) !== Number(activeLoan.amount) && (
                        <p className="text-[10px] text-muted-foreground">Original total: {fmt(Number(activeLoan.original_amount))} RWF</p>
                      )}
                    </div>
                    <Badge variant={activeLoan.status === 'PAID' ? 'secondary' : 'default'}>{activeLoan.status}</Badge>
                  </CardContent>
                </Card>

                {activeLoan.status === 'PENDING' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button variant="outline" onClick={() => { setActionKind('ADD'); setActAmount(0); setActNote(''); }}>
                      <PlusCircle className="w-4 h-4 mr-1" /> Add Loan Amount
                    </Button>
                    <Button onClick={() => { setActionKind('FULL_REPAY'); setActAmount(Number(activeLoan.amount)); setActNote(''); }} className="bg-income hover:bg-income/90">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Record Full Re-payment
                    </Button>
                    <Button variant="outline" onClick={() => { setActionKind('PARTIAL'); setActAmount(0); setActNote(''); }}>
                      <Coins className="w-4 h-4 mr-1" /> Record Random Paid
                    </Button>
                  </div>
                )}

                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">History</CardTitle></CardHeader>
                  <CardContent>
                    {!history || history.length === 0 ? <p className="text-center text-muted-foreground py-3 text-sm">No actions recorded yet</p> :
                      <div className="space-y-1 text-sm">
                        {history.map(h => (
                          <div key={h.id} className="flex items-center justify-between py-2 border-b">
                            <div>
                              <span className="font-medium">{h.action === 'ADD' ? 'Increased' : h.action === 'FULL_REPAY' ? 'Fully repaid' : 'Partial paid'}</span>
                              <span className="text-xs text-muted-foreground ml-2">{format(new Date(h.occurred_at), 'MMM d, yyyy h:mm a')} · #{h.receipt_no}</span>
                              {h.note && <p className="text-[11px] text-muted-foreground italic">{h.note}</p>}
                            </div>
                            <span className={cn('font-bold', h.action === 'ADD' ? 'text-expense' : 'text-income')}>
                              {h.action === 'ADD' ? '+' : '-'}{fmt(Number(h.amount))}
                            </span>
                          </div>
                        ))}
                      </div>}
                  </CardContent></Card>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => { if (confirm('Delete this loan and all its history?')) { deleteLoan.mutate(activeLoan.id); setActiveLoan(null); } }}>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete loan
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action confirmation dialog */}
      <Dialog open={!!actionKind} onOpenChange={(o) => { if (!o) setActionKind(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionKind === 'ADD' ? 'Add Loan Amount' : actionKind === 'FULL_REPAY' ? 'Record Full Re-payment' : 'Record Random Paid Amount'}
            </DialogTitle>
            <DialogDescription>{actionKind && actionDescriptions[actionKind]}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="text-muted-foreground">Current outstanding</p>
              <p className="font-bold text-lg">{fmt(Number(activeLoan?.amount ?? 0))} RWF</p>
            </div>
            {actionKind !== 'FULL_REPAY' && (
              <div><Label>Amount (RWF)</Label><Input type="number" min={0} value={actAmount || ''} onChange={e => setActAmount(+e.target.value)} autoFocus /></div>
            )}
            <div><Label>Note (optional)</Label><Textarea value={actNote} onChange={e => setActNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionKind(null)}>Cancel</Button>
            <Button onClick={submitAction} disabled={createTx.isPending}>
              <Receipt className="w-4 h-4 mr-1" /> Confirm & Generate Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
