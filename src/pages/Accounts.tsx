import { useState } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Archive, Pencil, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from 'lucide-react';
import {
  useAccounts, useCreateAccount, useArchiveAccount, useUpdateAccount,
  type AccountKind, type Account,
} from '@/hooks/useAccounts';
import { AccountLogo, ACCOUNT_KIND_META } from '@/components/AccountLogo';

const fmt = (n: number) => n.toLocaleString('en-RW', { minimumFractionDigits: 0 });

const KIND_VALUES = ['CASH','BANK','MOBILE_MONEY','CREDIT_CARD','DEBIT_CARD','SAVINGS','INVESTMENT','CRYPTO','DIGITAL'] as const;

const accountSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name too long (max 60)'),
  kind: z.enum(KIND_VALUES),
  account_number: z.string().trim().max(32, 'Account number too long').optional().or(z.literal('')),
  current_balance: z.coerce.number().min(0, 'Balance cannot be negative').max(1_000_000_000_000, 'Balance too large'),
});

type FieldErrors = Partial<Record<'name' | 'kind' | 'account_number' | 'current_balance' | 'amount', string>>;

function ErrText({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null;
}

export default function AccountsPage() {
  const { data: accounts } = useAccounts();
  const create = useCreateAccount();
  const archive = useArchiveAccount();
  const update = useUpdateAccount();

  // Create
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('CASH');
  const [balance, setBalance] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState('');
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  // Edit
  const [editing, setEditing] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editKind, setEditKind] = useState<AccountKind>('CASH');
  const [editNumber, setEditNumber] = useState('');
  const [editBalance, setEditBalance] = useState<string>('');
  const [editErrors, setEditErrors] = useState<FieldErrors>({});

  // Adjust (deposit / withdraw)
  const [adjust, setAdjust] = useState<{ account: Account; mode: 'DEPOSIT' | 'WITHDRAW' } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string | undefined>();
  const [confirmAdjust, setConfirmAdjust] = useState(false);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferError, setTransferError] = useState<string | undefined>();
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  // Archive confirm
  const [archiveTarget, setArchiveTarget] = useState<Account | null>(null);

  const total = accounts?.reduce((s, a) => s + Number(a.current_balance), 0) ?? 0;

  const validateCreate = () => {
    const res = accountSchema.safeParse({
      name, kind, account_number: accountNumber, current_balance: balance || 0,
    });
    if (!res.success) {
      const errs: FieldErrors = {};
      res.error.errors.forEach(e => { errs[e.path[0] as keyof FieldErrors] = e.message; });
      setCreateErrors(errs);
      return null;
    }
    setCreateErrors({});
    return res.data;
  };

  const submit = async () => {
    const v = validateCreate();
    if (!v) return;
    try {
      await create.mutateAsync({
        name: v.name, kind: v.kind, current_balance: v.current_balance,
        account_number: v.account_number || undefined,
      });
      toast.success('Account created');
      setOpen(false); setName(''); setBalance(''); setAccountNumber(''); setKind('CASH');
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setEditName(a.name); setEditKind(a.kind);
    setEditNumber(a.account_number ?? '');
    setEditBalance(String(Number(a.current_balance)));
    setEditErrors({});
  };

  const submitEdit = async () => {
    if (!editing) return;
    const res = accountSchema.safeParse({ name: editName, kind: editKind, account_number: editNumber, current_balance: editBalance || 0 });
    if (!res.success) {
      const errs: FieldErrors = {};
      res.error.errors.forEach(e => { errs[e.path[0] as keyof FieldErrors] = e.message; });
      setEditErrors(errs);
      return;
    }
    try {
      await update.mutateAsync({
        id: editing.id,
        name: res.data.name, kind: res.data.kind,
        account_number: res.data.account_number || null,
        current_balance: res.data.current_balance,
      });
      toast.success('Account updated');
      setEditing(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const validateAdjust = (): number | null => {
    const amt = Number(adjustAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setAdjustError('Enter a positive amount'); return null; }
    if (amt > 1e12) { setAdjustError('Amount too large'); return null; }
    if (adjust?.mode === 'WITHDRAW' && amt > Number(adjust.account.current_balance)) {
      setAdjustError(`Insufficient balance. Available: ${fmt(Number(adjust.account.current_balance))} RWF`);
      return null;
    }
    setAdjustError(undefined);
    return amt;
  };

  const submitAdjust = async () => {
    if (!adjust) return;
    const amt = validateAdjust();
    if (amt === null) return;
    const delta = adjust.mode === 'DEPOSIT' ? amt : -amt;
    try {
      await update.mutateAsync({ id: adjust.account.id, current_balance: Number(adjust.account.current_balance) + delta });
      toast.success(`${adjust.mode === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ${fmt(amt)} RWF`);
      setAdjust(null); setAdjustAmount(''); setConfirmAdjust(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const validateTransfer = (): { amt: number; src: Account; dst: Account } | null => {
    if (!fromId) { setTransferError('Choose a source account'); return null; }
    if (!toId) { setTransferError('Choose a destination account'); return null; }
    if (fromId === toId) { setTransferError('Source and destination must differ'); return null; }
    const src = accounts?.find(a => a.id === fromId);
    const dst = accounts?.find(a => a.id === toId);
    if (!src || !dst) { setTransferError('Account not found'); return null; }
    const amt = Number(transferAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setTransferError('Enter a positive amount'); return null; }
    if (amt > Number(src.current_balance)) { setTransferError(`Insufficient balance. Available: ${fmt(Number(src.current_balance))} RWF`); return null; }
    setTransferError(undefined);
    return { amt, src, dst };
  };

  const submitTransfer = async () => {
    const v = validateTransfer();
    if (!v) return;
    try {
      await update.mutateAsync({ id: v.src.id, current_balance: Number(v.src.current_balance) - v.amt });
      await update.mutateAsync({ id: v.dst.id, current_balance: Number(v.dst.current_balance) + v.amt });
      toast.success(`Transferred ${fmt(v.amt)} RWF`);
      setTransferOpen(false); setFromId(''); setToId(''); setTransferAmount('');
      setConfirmTransfer(false);
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
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreateErrors({}); }}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Add Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MTN MoMo" maxLength={60} />
                  <ErrText msg={createErrors.name} />
                </div>
                <div><Label>Type</Label>
                  <Select value={kind} onValueChange={v => setKind(v as AccountKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACCOUNT_KIND_META) as AccountKind[]).map(k => (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2"><AccountLogo kind={k} size={20} />{ACCOUNT_KIND_META[k].label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account number (optional)</Label>
                  <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} maxLength={32} />
                  <ErrText msg={createErrors.account_number} />
                </div>
                <div>
                  <Label>Opening balance (RWF)</Label>
                  <Input type="number" min={0} value={balance} onChange={e => setBalance(e.target.value)} />
                  <ErrText msg={createErrors.current_balance} />
                </div>
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
          const meta = ACCOUNT_KIND_META[a.kind];
          return (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <AccountLogo kind={a.kind} size={44} />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{a.name}</CardTitle>
                    <Badge variant="secondary" className="mt-1 text-[10px]">{meta.label}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setArchiveTarget(a)} title="Archive"><Archive className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-2xl font-bold">{fmt(Number(a.current_balance))} <span className="text-sm font-normal text-muted-foreground">{a.currency}</span></p>
                  {a.account_number && <p className="text-xs text-muted-foreground mt-1">•••• {a.account_number.slice(-4)}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-income" onClick={() => { setAdjust({ account: a, mode: 'DEPOSIT' }); setAdjustAmount(''); setAdjustError(undefined); }}>
                    <ArrowDownCircle className="w-4 h-4 mr-1" /> Deposit
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-expense" onClick={() => { setAdjust({ account: a, mode: 'WITHDRAW' }); setAdjustAmount(''); setAdjustError(undefined); }}>
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
      <Dialog open={!!editing} onOpenChange={o => { if (!o) { setEditing(null); setEditErrors({}); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} maxLength={60} />
              <ErrText msg={editErrors.name} />
            </div>
            <div><Label>Type</Label>
              <Select value={editKind} onValueChange={v => setEditKind(v as AccountKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACCOUNT_KIND_META) as AccountKind[]).map(k => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2"><AccountLogo kind={k} size={20} />{ACCOUNT_KIND_META[k].label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account number</Label>
              <Input value={editNumber} onChange={e => setEditNumber(e.target.value)} maxLength={32} />
              <ErrText msg={editErrors.account_number} />
            </div>
            <div>
              <Label>Current balance (RWF)</Label>
              <Input type="number" min={0} value={editBalance} onChange={e => setEditBalance(e.target.value)} />
              <ErrText msg={editErrors.current_balance} />
            </div>
            <Button onClick={submitEdit} className="w-full" disabled={update.isPending}>Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit / Withdraw dialog */}
      <Dialog open={!!adjust} onOpenChange={o => { if (!o) { setAdjust(null); setAdjustError(undefined); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{adjust?.mode === 'DEPOSIT' ? 'Deposit into' : 'Withdraw from'} {adjust?.account.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Current balance: <strong>{fmt(Number(adjust?.account.current_balance ?? 0))} RWF</strong>
            </div>
            <div>
              <Label>Amount (RWF)</Label>
              <Input type="number" min={0} value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
              <ErrText msg={adjustError} />
            </div>
            <Button
              onClick={() => { if (validateAdjust() !== null) setConfirmAdjust(true); }}
              className="w-full"
              disabled={update.isPending}
            >
              Confirm {adjust?.mode === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAdjust} onOpenChange={setConfirmAdjust}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {adjust?.mode === 'DEPOSIT' ? 'deposit' : 'withdrawal'}</AlertDialogTitle>
            <AlertDialogDescription>
              {adjust?.mode === 'DEPOSIT' ? 'Add' : 'Remove'} <strong>{fmt(Number(adjustAmount) || 0)} RWF</strong>{' '}
              {adjust?.mode === 'DEPOSIT' ? 'to' : 'from'} <strong>{adjust?.account.name}</strong>. This updates the balance immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitAdjust}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={o => { setTransferOpen(o); if (!o) { setTransferError(undefined); } }}>
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
            <div>
              <Label>Amount (RWF)</Label>
              <Input type="number" min={0} value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
              <ErrText msg={transferError} />
            </div>
            <Button onClick={() => { if (validateTransfer()) setConfirmTransfer(true); }} className="w-full" disabled={update.isPending}>
              Review & Transfer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmTransfer} onOpenChange={setConfirmTransfer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Transfer <strong>{fmt(Number(transferAmount) || 0)} RWF</strong> from{' '}
              <strong>{accounts?.find(a => a.id === fromId)?.name}</strong> to{' '}
              <strong>{accounts?.find(a => a.id === toId)?.name}</strong>. Both balances will update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitTransfer}>Transfer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirm */}
      <AlertDialog open={!!archiveTarget} onOpenChange={o => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive account?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveTarget?.name}</strong> will be hidden from your accounts list.
              Balance: <strong>{fmt(Number(archiveTarget?.current_balance ?? 0))} RWF</strong>. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!archiveTarget) return;
                try {
                  await archive.mutateAsync(archiveTarget.id);
                  toast.success('Account archived');
                  setArchiveTarget(null);
                } catch (e: any) { toast.error(e.message); }
              }}
            >Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
