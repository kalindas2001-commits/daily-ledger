import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Plus, Trash2, HandCoins, Wallet } from 'lucide-react';
import { useLoans, useCreateLoan, useMarkLoanPaid, useDeleteLoan } from '@/hooks/useLoans';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Loans() {
  const { data: loans, isLoading } = useLoans();
  const createLoan = useCreateLoan();
  const markPaid = useMarkLoanPaid();
  const deleteLoan = useDeleteLoan();

  const [addOpen, setAddOpen] = useState(false);
  const [loanType, setLoanType] = useState<'GIVEN' | 'RECEIVED'>('GIVEN');
  const [personName, setPersonName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [loanDate, setLoanDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusTab, setStatusTab] = useState('PENDING');

  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { minimumFractionDigits: 0 });

  const givenPending = useMemo(() => loans?.filter(l => l.type === 'GIVEN' && l.status === statusTab) ?? [], [loans, statusTab]);
  const receivedPending = useMemo(() => loans?.filter(l => l.type === 'RECEIVED' && l.status === statusTab) ?? [], [loans, statusTab]);

  const totalGivenPending = useMemo(() => loans?.filter(l => l.type === 'GIVEN' && l.status === 'PENDING').reduce((s, l) => s + Number(l.amount), 0) ?? 0, [loans]);
  const totalReceivedPending = useMemo(() => loans?.filter(l => l.type === 'RECEIVED' && l.status === 'PENDING').reduce((s, l) => s + Number(l.amount), 0) ?? 0, [loans]);

  const handleCreate = async () => {
    if (!personName.trim()) { toast.error('Enter person name'); return; }
    if (amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      await createLoan.mutateAsync({ person_name: personName.trim(), amount, type: loanType, description: description || undefined, loan_date: loanDate });
      toast.success('Loan added');
      setAddOpen(false);
      setPersonName(''); setAmount(0); setDescription('');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleMarkPaid = async (id: string) => {
    try { await markPaid.mutateAsync(id); toast.success('Marked as paid'); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteLoan.mutateAsync(id); toast.success('Loan deleted'); }
    catch (err: any) { toast.error(err.message); }
  };

  const LoanCard = ({ loan }: { loan: any }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm">{loan.person_name}</p>
          {loan.status === 'PAID' && <Badge variant="secondary" className="text-[10px]">Paid</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(loan.loan_date), 'MMM d, yyyy')}
          {loan.description && ` · ${loan.description}`}
        </p>
        {loan.paid_date && <p className="text-[10px] text-muted-foreground">Paid: {format(new Date(loan.paid_date), 'MMM d, yyyy')}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('font-bold text-sm', loan.type === 'GIVEN' ? 'text-expense' : 'text-income')}>
          {fmt(Number(loan.amount))} RWF
        </span>
        {loan.status === 'PENDING' && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-income" onClick={() => handleMarkPaid(loan.id)} title="Mark as Paid">
            <CheckCircle className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(loan.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-expense/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-expense/10 flex items-center justify-center shrink-0">
              <HandCoins className="w-5 h-5 text-expense" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">People Owe Me</p>
              <p className="text-lg font-bold text-expense">{fmt(totalGivenPending)} RWF</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-income/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-income/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-income" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">I Owe People</p>
              <p className="text-lg font-bold text-income">{fmt(totalReceivedPending)} RWF</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status filter */}
      <div className="flex items-center justify-between">
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList>
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="PAID">Paid</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Loan
        </Button>
      </div>

      {/* People Owe Me */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-expense" /> People Owe Me (Loans Given)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <p className="text-center text-muted-foreground py-4">Loading...</p> :
            givenPending.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No loans</p> :
            givenPending.map(l => <LoanCard key={l.id} loan={l} />)}
        </CardContent>
      </Card>

      {/* I Owe People */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="w-4 h-4 text-income" /> I Owe People (Loans Received)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <p className="text-center text-muted-foreground py-4">Loading...</p> :
            receivedPending.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">No loans</p> :
            receivedPending.map(l => <LoanCard key={l.id} loan={l} />)}
        </CardContent>
      </Card>

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
                  )}>
                  {t === 'GIVEN' ? 'I Gave (Lent)' : 'I Received (Borrowed)'}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Person Name</Label>
              <Input placeholder="Who?" value={personName} onChange={e => setPersonName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Amount (RWF)</Label>
              <Input type="number" min={0} placeholder="0" value={amount || ''} onChange={e => setAmount(+e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} />
            </div>
            <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLoan.isPending}>Save Loan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
