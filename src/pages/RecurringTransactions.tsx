import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Repeat, CalendarDays } from 'lucide-react';
import { useRecurringTransactions, useCreateRecurring, useDeleteRecurring, useToggleRecurring, useCategories } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

import { PAYMENT_METHODS, PaymentMethodOption, PaymentMethodLogo } from '@/components/PaymentMethodLogo';

export default function RecurringTransactions() {
  const { data: recurring, isLoading } = useRecurringTransactions();
  const { data: categories } = useCategories();
  const createRec = useCreateRecurring();
  const deleteRec = useDeleteRecurring();
  const toggleRec = useToggleRecurring();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [frequency, setFrequency] = useState('monthly');
  const [nextRunDate, setNextRunDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const filteredCategories = categories?.filter((c) => c.type === type) ?? [];
  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { minimumFractionDigits: 0 });

  const handleCreate = async () => {
    if (!category) { toast.error('Select a category'); return; }
    if (unitPrice <= 0) { toast.error('Price must be > 0'); return; }
    try {
      await createRec.mutateAsync({
        category, description: description || undefined, quantity, unit_price: unitPrice,
        payment_method: paymentMethod, type, frequency, next_run_date: nextRunDate,
      });
      toast.success('Recurring transaction created');
      setDialogOpen(false);
      setCategory(''); setDescription(''); setQuantity(1); setUnitPrice(0);
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recurring Transactions</h2>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2"><Plus className="w-4 h-4" />Add</Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : !recurring?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No recurring transactions set up yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {recurring.map((r) => (
            <Card key={r.id} className={cn(!r.is_active && 'opacity-50')}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', r.type === 'INCOME' ? 'bg-income' : 'bg-expense')} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.category}</p>
                    <p className="text-xs text-muted-foreground">
                      <Repeat className="inline w-3 h-3 mr-1" />{r.frequency}
                      <CalendarDays className="inline w-3 h-3 ml-2 mr-1" />Next: {format(new Date(r.next_run_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn('text-sm font-semibold', r.type === 'INCOME' ? 'text-income' : 'text-expense')}>
                    {fmt(Number(r.quantity ?? 1) * Number(r.unit_price))} RWF
                  </span>
                  <Switch checked={r.is_active ?? false} onCheckedChange={(v) => toggleRec.mutate({ id: r.id, is_active: v })} />
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteRec.mutate(r.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Recurring Transaction</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex rounded-lg overflow-hidden border">
              {(['INCOME', 'EXPENSE'] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setType(t); setCategory(''); }}
                  className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                    type === t ? (t === 'INCOME' ? 'bg-income text-primary-foreground' : 'bg-expense text-primary-foreground') : 'bg-secondary text-secondary-foreground'
                  )}>{t}</button>
              ))}
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{filteredCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} /></div>
              <div className="space-y-1"><Label>Unit Price (RWF)</Label><Input type="number" min={0} value={unitPrice || ''} onChange={(e) => setUnitPrice(+e.target.value)} /></div>
            </div>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="space-y-1"><Label>Next Run Date</Label><Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} /></div>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <span className="flex items-center gap-2 truncate"><PaymentMethodLogo method={paymentMethod} size={20} />{paymentMethod}</span>
              </SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}><PaymentMethodOption method={m} /></SelectItem>)}</SelectContent>
            </Select>

            <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createRec.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
