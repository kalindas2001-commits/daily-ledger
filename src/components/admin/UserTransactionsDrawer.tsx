import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenantTransactions } from '@/hooks/useEditRequests';
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';

const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-RW');

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
  userName?: string;
}

export default function UserTransactionsDrawer({ open, onOpenChange, userId, userName }: Props) {
  const { data, isLoading } = useTenantTransactions(userId ?? undefined);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const filtered = useMemo(() => {
    return (data ?? []).filter(t => {
      if (type !== 'ALL' && t.type !== type) return false;
      if (q && !`${t.category} ${t.description ?? ''} ${t.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, q, type]);

  const stats = useMemo(() => {
    const income = filtered.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
    const expense = filtered.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{userName ? `${userName}'s transactions` : 'Team transactions'}</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <StatCard label="Income" value={`${fmt(stats.income)} RWF`} tone="income" icon={TrendingUp} />
          <StatCard label="Expense" value={`${fmt(stats.expense)} RWF`} tone="expense" icon={TrendingDown} />
          <StatCard label="Net" value={`${fmt(stats.net)} RWF`} tone={stats.net >= 0 ? 'income' : 'expense'} icon={ArrowLeftRight} />
          <StatCard label="Records" value={String(stats.count)} tone="neutral" />
        </div>

        <div className="flex gap-2 mt-4">
          <Input placeholder="Search category, notes…" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No transactions found.</CardContent></Card>
          )}
          {filtered.map(t => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={t.type === 'INCOME' ? 'default' : 'destructive'} className="text-[10px]">{t.type}</Badge>
                    <span className="font-medium text-sm truncate">{t.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {format(new Date(t.transaction_date), 'MMM d, yyyy')} · {t.description || t.notes || '—'}
                  </p>
                  {!userId && <p className="text-[10px] text-muted-foreground/70">{t.full_name || t.email}</p>}
                </div>
                <div className={`text-right font-semibold ${t.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                  {t.type === 'INCOME' ? '+' : '-'}{fmt(t.total_amount)} <span className="text-xs font-normal text-muted-foreground">RWF</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({ label, value, tone, icon: Icon }: { label: string; value: string; tone: 'income' | 'expense' | 'neutral'; icon?: any }) {
  const cls = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${cls}`} />}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className={`text-base font-bold mt-1 ${cls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
