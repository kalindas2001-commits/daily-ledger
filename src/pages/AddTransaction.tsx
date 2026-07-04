import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ChevronDown, Sparkles, Tag as TagIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCategories, useCreateTransaction } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Card', 'Visa', 'MasterCard', 'Apple Pay', 'Google Pay', 'PayPal', 'Crypto', 'Cheque', 'QR Payment'];
const PLACE_TYPES = ['Home', 'Office', 'Online', 'ATM', 'Shop', 'Restaurant', 'Market', 'Other'];
const MOODS = ['😊 Happy', '😌 Planned', '😰 Stressed', '🤑 Impulse', '🎉 Celebration', '😐 Neutral', '😟 Worried'];
const LIFE_EVENTS = ['Birthday', 'Wedding', 'Vacation', 'Moving House', 'New Baby', 'Graduation', 'Anniversary', 'Emergency', 'Holiday'];
const INCOME_SOURCES = ['Salary', 'Client', 'Business', 'Side Hustle', 'Gift', 'Refund', 'Interest', 'Dividend', 'Commission', 'Bonus', 'Rental Income'];
const SUGGESTED_TAGS = ['Family', 'Work', 'Business', 'Health', 'Children', 'Holiday', 'Emergency', 'School', 'Gift'];

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
  const [fee, setFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [accountId, setAccountId] = useState<string>('');
  // Advanced
  const [merchantName, setMerchantName] = useState('');
  const [merchantPhone, setMerchantPhone] = useState('');
  const [placeType, setPlaceType] = useState('');
  const [city, setCity] = useState('');
  const [purpose, setPurpose] = useState('');
  const [incomeSource, setIncomeSource] = useState('');
  const [mood, setMood] = useState('');
  const [lifeEvent, setLifeEvent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const subtotal = quantity * unitPrice;
  const total = Math.max(0, subtotal + fee - discount + tax);
  const filteredCategories = categories?.filter((c) => c.type === type) ?? [];

  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const addTag = () => { const v = tagInput.trim(); if (v && !tags.includes(v)) setTags([...tags, v]); setTagInput(''); };

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
        transaction_fee: fee || undefined,
        discount: discount || undefined,
        tax_amount: tax || undefined,
        final_amount: total,
        payment_method: paymentMethod,
        account_id: accountId || undefined,
        merchant_name: merchantName || undefined,
        merchant_phone: merchantPhone || undefined,
        place_type: placeType || undefined,
        city: city || undefined,
        purpose: purpose || undefined,
        income_source: type === 'INCOME' ? (incomeSource || undefined) : undefined,
        mood: mood || undefined,
        life_event: lifeEvent || undefined,
        tags: tags.length ? tags : undefined,
        notes: notes || undefined,
        type,
      });
      toast.success('Personal financial record saved!');
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
          <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> New Personal Financial Record</CardTitle>
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

            {/* Fees / Discount / Tax */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Fee</Label><Input type="number" value={fee || ''} onChange={e => setFee(+e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Discount</Label><Input type="number" value={discount || ''} onChange={e => setDiscount(+e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Tax</Label><Input type="number" value={tax || ''} onChange={e => setTax(+e.target.value)} /></div>
            </div>

            {/* Total */}
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">Subtotal: {fmt(subtotal)} · Fee +{fmt(fee)} · Discount -{fmt(discount)} · Tax +{fmt(tax)}</p>
              <p className={cn('text-3xl font-bold mt-1', type === 'INCOME' ? 'text-income' : 'text-expense')}>{fmt(total)} RWF</p>
            </div>

            {/* Payment method + Account */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
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

            {/* Advanced Section */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Advanced details (make it a real story)</span>
                  <ChevronDown className={cn("w-4 h-4 transition", advancedOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {type === 'INCOME' && (
                  <div className="space-y-2"><Label>Income Source</Label>
                    <Select value={incomeSource} onValueChange={setIncomeSource}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{INCOME_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Merchant / Payer</Label><Input value={merchantName} onChange={e => setMerchantName(e.target.value)} placeholder="Store name or person" /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={merchantPhone} onChange={e => setMerchantPhone(e.target.value)} placeholder="+250…" /></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Where</Label>
                    <Select value={placeType} onValueChange={setPlaceType}>
                      <SelectTrigger><SelectValue placeholder="Place type" /></SelectTrigger>
                      <SelectContent>{PLACE_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>City</Label><Input value={city} onChange={e => setCity(e.target.value)} placeholder="Kigali" /></div>
                </div>

                <div className="space-y-2"><Label>Purpose / Reason</Label><Input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Monthly rent, Birthday gift" /></div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Mood</Label>
                    <Select value={mood} onValueChange={setMood}>
                      <SelectTrigger><SelectValue placeholder="How you felt" /></SelectTrigger>
                      <SelectContent>{MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Life Event</Label>
                    <Select value={lifeEvent} onValueChange={setLifeEvent}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>{LIFE_EVENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><TagIcon className="w-3.5 h-3.5" /> Tags</Label>
                  <div className="flex gap-2">
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Type & press Enter" />
                    <Button type="button" variant="outline" onClick={addTag}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SUGGESTED_TAGS.map(t => (
                      <Badge key={t} variant={tags.includes(t) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleTag(t)}>{t}</Badge>
                    ))}
                    {tags.filter(t => !SUGGESTED_TAGS.includes(t)).map(t => (
                      <Badge key={t} variant="default" className="cursor-pointer gap-1" onClick={() => toggleTag(t)}>{t}<X className="w-3 h-3" /></Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2"><Label>Personal Journal Note</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="The story behind this transaction..." /></div>
              </CollapsibleContent>
            </Collapsible>

            <Button type="submit" className="w-full" disabled={createTx.isPending}>
              {createTx.isPending ? 'Saving...' : 'Save Financial Record'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
