import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useBudgets, useCreateBudget, useDeleteBudget, useCategories, useTransactions } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function BudgetsPage() {
  const { data: budgets, isLoading } = useBudgets();
  const { data: categories } = useCategories();
  const createBudget = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const now = new Date();
  const monthFrom = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthTo = format(endOfMonth(now), 'yyyy-MM-dd');
  const { data: monthTx } = useTransactions({ from: monthFrom, to: monthTo });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(0);
  const [threshold, setThreshold] = useState(80);

  const expenseCategories = categories?.filter((c) => c.type === 'EXPENSE') ?? [];

  const spendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    monthTx?.forEach((tx) => {
      if (tx.type === 'EXPENSE') {
        map[tx.category] = (map[tx.category] ?? 0) + (tx.total_amount ?? 0);
      }
    });
    return map;
  }, [monthTx]);

  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { minimumFractionDigits: 0 });

  const handleCreate = async () => {
    if (!category) { toast.error('Select a category'); return; }
    if (limit <= 0) { toast.error('Limit must be > 0'); return; }
    try {
      await createBudget.mutateAsync({ category, monthly_limit: limit, alert_threshold: threshold });
      toast.success('Budget created');
      setDialogOpen(false); setCategory(''); setLimit(0);
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budgets — {format(now, 'MMMM yyyy')}</h2>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Budget</Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : !budgets?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No budgets set. Add one to track spending limits.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const spent = spendingMap[b.category] ?? 0;
            const pct = b.monthly_limit > 0 ? Math.min(100, (spent / Number(b.monthly_limit)) * 100) : 0;
            const overThreshold = pct >= (b.alert_threshold ?? 80);
            const overBudget = pct >= 100;

            return (
              <Card key={b.id} className={cn(overBudget && 'border-destructive/50')}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {overThreshold && <AlertTriangle className={cn('w-4 h-4', overBudget ? 'text-destructive' : 'text-accent')} />}
                      <div>
                        <span className="font-medium text-sm">{b.category}</span>
                        {b.created_at && (
                          <p className="text-[10px] text-muted-foreground">
                            Set {format(new Date(b.created_at), 'MMM d, yyyy · h:mm a')}
                            {b.updated_at && b.updated_at !== b.created_at && ` · Updated ${format(new Date(b.updated_at), 'MMM d, h:mm a')}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteBudget.mutate(b.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Progress value={pct} className={cn('h-2.5', overBudget ? '[&>div]:bg-destructive' : overThreshold ? '[&>div]:bg-accent' : '[&>div]:bg-primary')} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(spent)} RWF spent</span>
                    <span>{fmt(Number(b.monthly_limit))} RWF limit ({pct.toFixed(0)}%)</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Expense category" /></SelectTrigger>
              <SelectContent>{expenseCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="space-y-1"><Label>Monthly Limit (RWF)</Label><Input type="number" min={0} value={limit || ''} onChange={(e) => setLimit(+e.target.value)} /></div>
            <div className="space-y-1"><Label>Alert Threshold (%)</Label><Input type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(+e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBudget.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
