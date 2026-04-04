import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Search, Pencil } from 'lucide-react';
import { useTransactions, useDeleteTransaction, useUpdateTransaction, useCategories } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Card'];

export default function TransactionsList() {
  const { data: transactions, isLoading } = useTransactions();
  const { data: categories } = useCategories();
  const deleteTx = useDeleteTransaction();
  const updateTx = useUpdateTransaction();

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

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterCategory !== 'ALL' && tx.category !== filterCategory) return false;
      if (filterPayment !== 'ALL' && tx.payment_method !== filterPayment) return false;
      if (search) {
        const q = search.toLowerCase();
        return tx.category.toLowerCase().includes(q) || tx.description?.toLowerCase().includes(q) || tx.id.toLowerCase().includes(q);
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Transactions</span>
            <span className="text-sm text-muted-foreground font-normal">{filtered.length} records</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions found</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', tx.type === 'INCOME' ? 'bg-income' : 'bg-expense')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.transaction_date), 'MMM d, yyyy')} · {tx.payment_method}
                        {tx.description && ` · ${tx.description}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className={cn('text-sm font-semibold', tx.type === 'INCOME' ? 'text-income' : 'text-expense')}>
                        {tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.total_amount ?? 0)} RWF
                      </p>
                      {(tx.quantity ?? 1) > 1 && (
                        <p className="text-xs text-muted-foreground">{tx.quantity} × {fmt(tx.unit_price)}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="sm:opacity-0 sm:group-hover:opacity-100 h-8 w-8" onClick={() => openEdit(tx)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="sm:opacity-0 sm:group-hover:opacity-100 text-destructive h-8 w-8" onClick={() => handleDelete(tx.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder="Description (optional)" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateTx.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
