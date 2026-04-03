import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Search } from 'lucide-react';
import { useTransactions, useDeleteTransaction, useCategories } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function TransactionsList() {
  const { data: transactions, isLoading } = useTransactions();
  const { data: categories } = useCategories();
  const deleteTx = useDeleteTransaction();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPayment, setFilterPayment] = useState<string>('ALL');

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterCategory !== 'ALL' && tx.category !== filterCategory) return false;
      if (filterPayment !== 'ALL' && tx.payment_method !== filterPayment) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          tx.category.toLowerCase().includes(q) ||
          tx.description?.toLowerCase().includes(q) ||
          tx.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, search, filterType, filterCategory, filterPayment]);

  const uniquePayments = useMemo(() => {
    const set = new Set(transactions?.map((t) => t.payment_method).filter(Boolean) ?? []);
    return Array.from(set) as string[];
  }, [transactions]);

  const handleDelete = async (id: string) => {
    try {
      await deleteTx.mutateAsync(id);
      toast.success('Transaction deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* Filters */}
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

      {/* Transactions */}
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
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={cn('text-sm font-semibold', tx.type === 'INCOME' ? 'text-income' : 'text-expense')}>
                        {tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.total_amount ?? 0)}
                      </p>
                      {(tx.quantity ?? 1) > 1 && (
                        <p className="text-xs text-muted-foreground">{tx.quantity} × {fmt(tx.unit_price)}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => handleDelete(tx.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
