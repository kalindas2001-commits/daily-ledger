import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { useTransactions, useDailySummaries, useBudgets } from '@/hooks/useTransactions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(120, 50%, 40%)'];

type RangeKey = 'today' | 'week' | 'month' | '3months' | '6months' | 'year';

function getRange(key: RangeKey): { from: string; to: string; label: string } {
  const now = new Date();
  const toStr = format(now, 'yyyy-MM-dd');
  switch (key) {
    case 'today': return { from: toStr, to: toStr, label: 'Today' };
    case 'week': return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), label: 'This Week' };
    case 'month': return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd'), label: 'This Month' };
    case '3months': return { from: format(subMonths(startOfMonth(now), 2), 'yyyy-MM-dd'), to: toStr, label: 'Last 3 Months' };
    case '6months': return { from: format(subMonths(startOfMonth(now), 5), 'yyyy-MM-dd'), to: toStr, label: 'Last 6 Months' };
    case 'year': return { from: format(subMonths(startOfMonth(now), 11), 'yyyy-MM-dd'), to: toStr, label: 'Last 12 Months' };
  }
}

export default function Dashboard() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('month');
  const range = getRange(rangeKey);

  const { data: txData } = useTransactions({ from: range.from, to: range.to });
  const { data: summaries } = useDailySummaries(range.from, range.to);
  const { data: budgets } = useBudgets();

  // Current month transactions for budget tracking
  const now = new Date();
  const monthFrom = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthTo = format(endOfMonth(now), 'yyyy-MM-dd');
  const { data: monthTx } = useTransactions({ from: monthFrom, to: monthTo });

  const stats = useMemo(() => {
    if (!txData) return { income: 0, expense: 0 };
    let income = 0, expense = 0;
    for (const tx of txData) {
      const amt = tx.total_amount ?? 0;
      if (tx.type === 'INCOME') income += amt;
      else expense += amt;
    }
    return { income, expense };
  }, [txData]);

  const categoryData = useMemo(() => {
    if (!txData) return [];
    const map: Record<string, number> = {};
    for (const tx of txData) {
      if (tx.type === 'EXPENSE') map[tx.category] = (map[tx.category] ?? 0) + (tx.total_amount ?? 0);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txData]);

  const chartData = useMemo(() => {
    if (!summaries) return [];
    return summaries.map((s) => ({
      date: format(new Date(s.summary_date), 'MMM d'),
      Income: s.total_income ?? 0,
      Expense: s.total_expense ?? 0,
    }));
  }, [summaries]);

  const budgetAlerts = useMemo(() => {
    if (!budgets || !monthTx) return [];
    const spendMap: Record<string, number> = {};
    monthTx.forEach((tx) => {
      if (tx.type === 'EXPENSE') spendMap[tx.category] = (spendMap[tx.category] ?? 0) + (tx.total_amount ?? 0);
    });
    return budgets
      .map((b) => {
        const spent = spendMap[b.category] ?? 0;
        const pct = Number(b.monthly_limit) > 0 ? (spent / Number(b.monthly_limit)) * 100 : 0;
        return { ...b, spent, pct: Math.min(pct, 100) };
      })
      .filter((b) => b.pct >= (b.alert_threshold ?? 80));
  }, [budgets, monthTx]);

  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { minimumFractionDigits: 0 });
  const net = stats.income - stats.expense;

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex justify-end">
        <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="3months">Last 3 Months</SelectItem>
            <SelectItem value="6months">Last 6 Months</SelectItem>
            <SelectItem value="year">Last 12 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard title="Income" value={`${fmt(stats.income)} RWF`} icon={TrendingUp} variant="income" />
        <KPICard title="Expense" value={`${fmt(stats.expense)} RWF`} icon={TrendingDown} variant="expense" />
        <KPICard title="Net Balance" value={`${fmt(net)} RWF`} icon={DollarSign} variant={net >= 0 ? 'income' : 'expense'} />
        <KPICard title="Transactions" value={String(txData?.length ?? 0)} icon={BarChart3} variant="income" />
      </div>

      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <Card className="border-accent/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-accent">⚠ Budget Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetAlerts.map((b) => (
              <div key={b.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{b.category}</span>
                  <span className="text-muted-foreground">{fmt(b.spent)} / {fmt(Number(b.monthly_limit))} RWF</span>
                </div>
                <Progress value={b.pct} className={cn('h-2', b.pct >= 100 ? '[&>div]:bg-destructive' : '[&>div]:bg-accent')} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Income vs Expenses ({range.label})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="Income" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expense" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              {categoryData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No expenses yet</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                      {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmt(v)} RWF`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {categoryData.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground">{c.name}</span>
                  </div>
                  <span className="font-medium">{fmt(c.value)} RWF</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, variant }: { title: string; value: string; icon: any; variant: 'income' | 'expense' }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
            <p className={cn('text-lg sm:text-2xl font-bold mt-1 truncate', variant === 'income' ? 'text-income' : 'text-expense')}>
              {value}
            </p>
          </div>
          <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0', variant === 'income' ? 'bg-income/10' : 'bg-expense/10')}>
            <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', variant === 'income' ? 'text-income' : 'text-expense')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
