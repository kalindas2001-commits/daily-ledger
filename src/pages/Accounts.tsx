import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus, Wallet, Building2, Smartphone, CreditCard, PiggyBank, TrendingUp, Bitcoin,
  Archive, Pencil, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
} from 'lucide-react';
import {
  useAccounts, useCreateAccount, useArchiveAccount, useUpdateAccount, type AccountKind, type Account,
} from '@/hooks/useAccounts';

const KIND_META: Record<AccountKind, { label: string; icon: any; color: string }> = {
  CASH: { label: 'Cash Wallet', icon: Wallet, color: 'bg-emerald-500/10 text-emerald-600' },
  BANK: { label: 'Bank Account', icon: Building2, color: 'bg-blue-500/10 text-blue-600' },
  MOBILE_MONEY: { label: 'Mobile Money', icon: Smartphone, color: 'bg-amber-500/10 text-amber-600' },
  CREDIT_CARD: { label: 'Credit Card', icon: CreditCard, color: 'bg-purple-500/10 text-purple-600' },
  DEBIT_CARD: { label: 'Debit Card', icon: CreditCard, color: 'bg-indigo-500/10 text-indigo-600' },
  SAVINGS: { label: 'Savings', icon: PiggyBank, color: 'bg-teal-500/10 text-teal-600' },
  INVESTMENT: { label: 'Investment', icon: TrendingUp, color: 'bg-rose-500/10 text-rose-600' },
  CRYPTO: { label: 'Crypto Wallet', icon: Bitcoin, color: 'bg-orange-500/10 text-orange-600' },
  DIGITAL: { label: 'Digital Wallet', icon: Wallet, color: 'bg-cyan-500/10 text-cyan-600' },
};

const fmt = (n: number) => n.toLocaleString('en-RW', { minimumFractionDigits: 0 });

export default function AccountsPage() {
  const { data: accounts } = useAccounts();
  const create = useCreateAccount();
  const archive = useArchiveAccount();
  const update = useUpdateAccount();

  // Create
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('CASH');
  const [balance, setBalance] = useState(0);
  const [accountNumber, setAccountNumber] = useState('');

  // Edit
  const [editing, setEditing] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editKind, setEditKind] = useState<AccountKind>('CASH');
  const [editNumber, setEditNumber] = useState('');
  const [editBalance, setEditBalance] = useState(0);

  // Adjust (deposit / withdraw)
  const [adjust, setAdjust] = useState<{ account: Account; mode: 'DEPOSIT' | 'WITHDRAW' } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState(0);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmount, setTransferAmount] = useState(0);

  const total = accounts?.reduce((s, a) => s + Number(a.current_balance), 0) ?? 0;

  const submit = async () => {
    if (!name.trim()) return toast.error('Enter a name');
    try {
      await create.mutateAsync({ name: name.trim(), kind, current_balance: balance, account_number: accountNumber || undefined });
      toast.success('Account created');
      setOpen(false); setName(''); setBalance(0); setAccountNumber('');
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setEditName(a.name); setEditKind(a.kind);
    setEditNumber(a.account_number ?? '');
    setEditBalance(Number(a.current_balance));
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) return toast.error('Enter a name');
    try {
      await update.mutateAsync({
        id: editing.id,
        name: editName.trim(),
        kind: editKind,
        account_number: editNumber || null,
        current_balance: editBalance,
      });
      toast.success('Account updated');
      setEditing(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const submitAdjust = async () => {
    if (!adjust) return;
    if (adjustAmount <= 0) return toast.error('Enter a positive amount');
    const delta = adjust.mode === 'DEPOSIT' ? adjustAmount : -adjustAmount;
    const newBal = Number(adjust.account.current_balance) + delta;
    try {
      await update.mutateAsync({ id: adjust.account.id, current_balance: newBal });
      toast.success(`${adjust.mode === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ${fmt(adjustAmount)} RWF`);
      setAdjust(null); setAdjustAmount(0);
    } catch (e: any) { toast.error(e.message); }
  };

  const submitTransfer = async () => {
    if (!fromId || !toId || fromId === toId) return toast.error('Choose two different accounts');
    if (transferAmount <= 0) return toast.error('Enter a positive amount');
    const src = accounts?.find(a => a.id === fromId);
    const dst = accounts?.find(a => a.id === toId);
    if (!src || !dst) return;
    try {
      await update.mutateAsync({ id: src.id, current_balance: Number(src.current_balance) - transferAmount });
      await update.mutateAsync({ id: dst.id, current_balance: Number(dst.current_balance) + transferAmount });
      toast.success(`Transferred ${fmt(transferAmount)} RWF`);
      setTransferOpen(false); setFromId(''); setToId(''); setTransferAmount(0);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">My Accounts</h2>
          <p className="text-sm text-muted-foreground">Track cash, bank, mobile money & more</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={(accounts?.length ?? 0) < 2}>
            <ArrowLeftRight className="w-4 h-4 mr-1" /> Transfer
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Add Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MTN MoMo" /></div>
                <div><Label>Type</Label>
                  <Select value={kind} onValueChange={v => setKind(v as AccountKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Account number (optional)</Label><Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
                <div><Label>Opening balance (RWF)</Label><Input type="number" value={balance || ''} onChange={e => setBalance(+e.target.value)} /></div>
                <Button onClick={submit} className="w-full" disabled={create.isPending}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total across all accounts</p>
          <p className="text-3xl font-bold text-primary">{fmt(total)} RWF</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {accounts?.map(a => {
          const meta = KIND_META[a.kind];
          const Icon = meta.icon;
          return (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}><Icon className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{a.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{meta.label}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => archive.mutate(a.id)} title="Archive"><Archive className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-2xl font-bold">{fmt(Number(a.current_balance))} <span className="text-sm font-normal text-muted-foreground">{a.currency}</span></p>
                  {a.account_number && <p className="text-xs text-muted-foreground mt-1">•••• {a.account_number.slice(-4)}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-income" onClick={() => { setAdjust({ account: a, mode: 'DEPOSIT' }); setAdjustAmount(0); }}>
                    <ArrowDownCircle className="w-4 h-4 mr-1" /> Deposit
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-expense" onClick={() => { setAdjust({ account: a, mode: 'WITHDRAW' }); setAdjustAmount(0); }}>
                    <ArrowUpCircle className="w-4 h-4 mr-1" /> Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!accounts?.length && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No accounts yet. Add one to start tracking your money flow.</p>}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div><Label>Type</Label>
              <Select value={editKind} onValueChange={v => setEditKind(v as AccountKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Account number</Label><Input value={editNumber} onChange={e => setEditNumber(e.target.value)} /></div>
            <div><Label>Current balance (RWF)</Label><Input type="number" value={editBalance || ''} onChange={e => setEditBalance(+e.target.value)} /></div>
            <Button onClick={submitEdit} className="w-full" disabled={update.isPending}>Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit / Withdraw dialog */}
      <Dialog open={!!adjust} onOpenChange={o => !o && setAdjust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adjust?.mode === 'DEPOSIT' ? 'Deposit into' : 'Withdraw from'} {adjust?.account.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Current balance: <strong>{fmt(Number(adjust?.account.current_balance ?? 0))} RWF</strong>
            </div>
            <div><Label>Amount (RWF)</Label><Input type="number" value={adjustAmount || ''} onChange={e => setAdjustAmount(+e.target.value)} /></div>
            <Button onClick={submitAdjust} className="w-full" disabled={update.isPending}>
              Confirm {adjust?.mode === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer between accounts</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>From</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger><SelectValue placeholder="Source account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {fmt(Number(a.current_balance))} RWF</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>To</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger><SelectValue placeholder="Destination account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => a.id !== fromId).map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {fmt(Number(a.current_balance))} RWF</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (RWF)</Label><Input type="number" value={transferAmount || ''} onChange={e => setTransferAmount(+e.target.value)} /></div>
            <Button onClick={submitTransfer} className="w-full" disabled={update.isPending}>Transfer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
