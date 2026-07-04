import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Wallet, Building2, Smartphone, CreditCard, PiggyBank, TrendingUp, Bitcoin, Archive } from 'lucide-react';
import { useAccounts, useCreateAccount, useArchiveAccount, type AccountKind } from '@/hooks/useAccounts';

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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('CASH');
  const [balance, setBalance] = useState(0);
  const [accountNumber, setAccountNumber] = useState('');

  const total = accounts?.reduce((s, a) => s + Number(a.current_balance), 0) ?? 0;

  const submit = async () => {
    if (!name.trim()) return toast.error('Enter a name');
    try {
      await create.mutateAsync({ name: name.trim(), kind, current_balance: balance, account_number: accountNumber || undefined });
      toast.success('Account created');
      setOpen(false); setName(''); setBalance(0); setAccountNumber('');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Accounts</h2>
          <p className="text-sm text-muted-foreground">Track cash, bank, mobile money & more</p>
        </div>
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

      <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total across all accounts</p><p className="text-3xl font-bold text-primary">{fmt(total)} RWF</p></CardContent></Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {accounts?.map(a => {
          const meta = KIND_META[a.kind];
          const Icon = meta.icon;
          return (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.color}`}><Icon className="w-5 h-5" /></div>
                  <div className="flex-1"><CardTitle className="text-base">{a.name}</CardTitle><Badge variant="secondary" className="mt-1 text-[10px]">{meta.label}</Badge></div>
                  <Button variant="ghost" size="icon" onClick={() => archive.mutate(a.id)}><Archive className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{fmt(Number(a.current_balance))} <span className="text-sm font-normal text-muted-foreground">{a.currency}</span></p>
                {a.account_number && <p className="text-xs text-muted-foreground mt-1">•••• {a.account_number.slice(-4)}</p>}
              </CardContent>
            </Card>
          );
        })}
        {!accounts?.length && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No accounts yet. Add one to start tracking your money flow.</p>}
      </div>
    </div>
  );
}
