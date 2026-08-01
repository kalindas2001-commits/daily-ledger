import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCategories, useCreateTransaction } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';

import { PAYMENT_METHODS, PaymentMethodOption, PaymentMethodLogo } from '@/components/PaymentMethodLogo';

export default function AddTransaction() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const createTx = useCreateTransaction();

  const nowHHMM = format(new Date(), 'HH:mm');
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<string>(nowHHMM);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [accountId, setAccountId] = useState<string>('');

  const total = quantity * unitPrice;
  const filteredCategories = categories?.filter((c) => c.type === type) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) { toast.error('Please select a category'); return; }
    if (unitPrice <= 0) { toast.error('Unit price must be greater than 0'); return; }

    try {
      await createTx.mutateAsync({
        transaction_date: format(date, 'yyyy-MM-dd'),
        transaction_time: time ? `${time}:00` : `${format(new Date(), 'HH:mm:ss')}`,
        category,
        subcategory: subcategory || undefined,
        description: description || undefined,
        quantity, unit_price: unitPrice,
        final_amount: total,
        payment_method: paymentMethod,
        account_id: accountId || undefined,
        type,
      });
      toast.success('Transaction saved!');
      navigate('/transactions');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-RW', { minimumFractionDigits: 0 });

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 tracking-wide"><Sparkles className="w-5 h-5 text-primary" /> TRANSACTIONS</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type Toggle */}
            <div className="flex rounded-lg overflow-hidden border">
              {(['INCOME', 'EXPENSE'] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setType(t); setCategory(''); }}
                  className={cn('flex-1 py-2.5 text-sm font-medium transition-colors',
                    type === t ? (t === 'INCOME' ? 'bg-income text-primary-foreground' : 'bg-expense text-primary-foreground') : 'bg-secondary text-secondary-foreground'
                  )}>{t}</button>
              ))}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />{format(date, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            </div>

            {/* Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{filteredCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Subcategory</Label><Input value={subcategory} onChange={e => setSubcategory(e.target.value)} placeholder="e.g. Groceries" /></div>
            </div>

            {/* Quantity & Unit Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} /></div>
              <div className="space-y-2"><Label>Unit Price (RWF)</Label><Input type="number" min={0} step="1" value={unitPrice || ''} onChange={(e) => setUnitPrice(+e.target.value)} /></div>
            </div>

            {/* Total */}
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">Total amount</p>
              <p className={cn('text-3xl font-bold mt-1', type === 'INCOME' ? 'text-income' : 'text-expense')}>{fmt(total)} RWF</p>
            </div>

            {/* Payment method + Account */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <span className="flex items-center gap-2 truncate"><PaymentMethodLogo method={paymentMethod} size={20} />{paymentMethod}</span>
                  </SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}><PaymentMethodOption method={m} /></SelectItem>)}</SelectContent>

                </Select>
              </div>
              <div className="space-y-2"><Label>Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    {!accounts?.length && <div className="px-2 py-1.5 text-xs text-muted-foreground">Create accounts in the Accounts page</div>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" /></div>

            <Button type="submit" className="w-full" disabled={createTx.isPending}>
              {createTx.isPending ? 'Saving...' : 'Save Transaction'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
