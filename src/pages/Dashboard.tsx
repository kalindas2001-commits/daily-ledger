import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { useTransactions, useDailySummaries } from '@/hooks/useTransactions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const today = new Date();
const todayStr = format(today, 'yyyy-MM-dd');
const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

const PIE_COLORS = ['hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(120, 50%, 40%)'];

export default function Dashboard() {
  const { data: monthTx } = useTransactions({ from: monthStart, to: monthEnd });
  const { data: summaries } = useDailySummaries(monthStart, monthEnd);

  const stats = useMemo(() => {
    if (!monthTx) return { todayIncome: 0, todayExpense: 0, weekIncome: 0, weekExpense: 0, monthIncome: 0, monthExpense: 0 };

    let todayIncome = 0, todayExpense = 0, weekIncome = 0, weekExpense = 0, monthIncome = 0, monthExpense = 0;

    for (const tx of monthTx) {
      const amt = tx.total_amount ?? 0;
      if (tx.type === 'INCOME') {
        monthIncome += amt;
        if (tx.transaction_date === todayStr) todayIncome += amt;
        if (tx.transaction_date >= weekStart && tx.transaction_date <= weekEnd) weekIncome += amt;
      } else {
        monthExpense += amt;
        if (tx.transaction_date === todayStr) todayExpense += amt;
        if (tx.transaction_date >= weekStart && tx.transaction_date <= weekEnd) weekExpense += amt;
      }
    }
    return { todayIncome, todayExpense, weekIncome, weekExpense, monthIncome, monthExpense };
  }, [monthTx]);

  const categoryData = useMemo(() => {
    if (!monthTx) return [];
    const map: Record<string, number> = {};
    for (const tx of monthTx) {
      if (tx.type === 'EXPENSE') {
        map[tx.category] = (map[tx.category] ?? 0) + (tx.total_amount ?? 0);
      }
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTx]);

  const chartData = useMemo(() => {
    if (!summaries) return [];
    return summaries.map((s) => ({
      date: format(new Date(s.summary_date), 'MMM d'),
      Income: s.total_income ?? 0,
      Expense: s.total_expense ?? 0,
    }));
  }, [summaries]);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Today's Income" value={fmt(stats.todayIncome)} icon={TrendingUp} variant="income" />
        <KPICard title="Today's Expense" value={fmt(stats.todayExpense)} icon={TrendingDown} variant="expense" />
        <KPICard title="This Week Net" value={fmt(stats.weekIncome - stats.weekExpense)} icon={DollarSign} variant={stats.weekIncome - stats.weekExpense >= 0 ? 'income' : 'expense'} />
        <KPICard title="This Month Net" value={fmt(stats.monthIncome - stats.monthExpense)} icon={BarChart3} variant={stats.monthIncome - stats.monthExpense >= 0 ? 'income' : 'expense'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Income vs Expenses (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
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
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
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
                  <span className="font-medium">{fmt(c.value)}</span>
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
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${variant === 'income' ? 'text-income' : 'text-expense'}`}>
              {value}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${variant === 'income' ? 'bg-income/10' : 'bg-expense/10'}`}>
            <Icon className={`w-5 h-5 ${variant === 'income' ? 'text-income' : 'text-expense'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
