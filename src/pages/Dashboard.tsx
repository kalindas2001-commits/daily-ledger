import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Flame, PiggyBank, AlertTriangle, Lightbulb, HandCoins, Wallet } from 'lucide-react';
import { useTransactions, useDailySummaries, useBudgets } from '@/hooks/useTransactions';
import { useLoans } from '@/hooks/useLoans';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(120, 50%, 40%)', 'hsl(340, 65%, 50%)', 'hsl(60, 70%, 45%)'];

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
  const { data: loans } = useLoans();

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

  const categoryExpenseData = useMemo(() => {
    if (!txData) return [];
    const map: Record<string, number> = {};
    for (const tx of txData) {
      if (tx.type === 'EXPENSE') map[tx.category] = (map[tx.category] ?? 0) + (tx.total_amount ?? 0);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txData]);

  const categoryIncomeData = useMemo(() => {
    if (!txData) return [];
    const map: Record<string, number> = {};
    for (const tx of txData) {
      if (tx.type === 'INCOME') map[tx.category] = (map[tx.category] ?? 0) + (tx.total_amount ?? 0);
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
        return { ...b, spent, pct: Math.min(pct, 100), exceeded: pct >= 100 };
      })
      .filter((b) => b.pct >= (b.alert_threshold ?? 80));
  }, [budgets, monthTx]);

  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { minimumFractionDigits: 0 });

  // ---- Advanced Smart Insights engine -------------------------------------
  const insights = useMemo(() => {
    const result: {
      icon: any; title: string; text: string; suggestion?: string; type: 'info' | 'warning' | 'success' | 'critical';
    }[] = [];
    if (!txData || txData.length === 0) return result;

    const days = Math.max(differenceInDays(new Date(range.to), new Date(range.from)) + 1, 1);
    const expenses = txData.filter(t => t.type === 'EXPENSE');
    const incomes = txData.filter(t => t.type === 'INCOME');
    const amt = (t: any) => Number(t.total_amount ?? 0);
    const net = stats.income - stats.expense;

    // 1. Savings rate & health verdict
    if (stats.income > 0) {
      const sr = ((stats.income - stats.expense) / stats.income) * 100;
      result.push({
        icon: PiggyBank,
        title: `Savings rate ${sr.toFixed(1)}%`,
        text: sr < 0
          ? `You spent ${fmt(Math.abs(net))} RWF more than you earned in ${range.label.toLowerCase()}.`
          : `You kept ${fmt(net)} RWF of ${fmt(stats.income)} RWF earned.`,
        suggestion: sr < 0
          ? 'Cut the top expense category first, then set a monthly budget for it.'
          : sr < 10 ? 'Target at least 20% — automate a fixed transfer to savings on payday.'
          : sr < 30 ? 'Solid. Push toward 30% by trimming one recurring cost.'
          : 'Excellent — move the surplus into a savings goal so it is not spent.',
        type: sr < 0 ? 'critical' : sr < 10 ? 'warning' : sr >= 30 ? 'success' : 'info',
      });
    }

    // 2. Burn rate + projected month-end spend
    const burn = stats.expense / days;
    if (burn > 0) {
      const projected = burn * 30;
      result.push({
        icon: Flame,
        title: `Burn rate ${fmt(Math.round(burn))} RWF/day`,
        text: `At this pace a full 30 days costs about ${fmt(Math.round(projected))} RWF.`,
        suggestion: stats.income > 0 && projected > stats.income
          ? 'Projected spend exceeds your income pace — reduce daily spend or add income.'
          : 'Keep the daily pace and you stay within your earning pace.',
        type: stats.income > 0 && projected > stats.income ? 'warning' : 'info',
      });
    }

    // 3. Runway from surplus
    if (burn > 0 && net > 0) {
      result.push({
        icon: TrendingUp,
        title: `${Math.round(net / burn)} days of runway`,
        text: `Your ${fmt(net)} RWF surplus covers ${Math.round(net / burn)} more days at the current spend rate.`,
        suggestion: net / burn < 30 ? 'Aim for at least 90 days of cover as an emergency buffer.' : 'Healthy buffer — consider investing part of it.',
        type: net / burn < 30 ? 'warning' : 'success',
      });
    }

    // 4. Category concentration
    if (categoryExpenseData.length > 0 && stats.expense > 0) {
      const top = categoryExpenseData[0];
      const pct = (top.value / stats.expense) * 100;
      result.push({
        icon: pct > 60 ? AlertTriangle : Lightbulb,
        title: `${top.name} drives ${pct.toFixed(0)}% of spending`,
        text: `${fmt(top.value)} RWF of ${fmt(stats.expense)} RWF total expenses.`,
        suggestion: pct > 60
          ? 'One category dominates — a 10% cut here saves more than trimming everything else.'
          : `A 10% reduction in ${top.name} would free about ${fmt(Math.round(top.value * 0.1))} RWF.`,
        type: pct > 60 ? 'warning' : 'info',
      });
    }

    // 5. Anomaly: unusually large single expense
    if (expenses.length >= 3) {
      const sorted = [...expenses].sort((a, b) => amt(b) - amt(a));
      const biggest = sorted[0];
      const avg = expenses.reduce((s, t) => s + amt(t), 0) / expenses.length;
      if (avg > 0 && amt(biggest) > avg * 3) {
        result.push({
          icon: AlertTriangle,
          title: 'Unusual expense detected',
          text: `${biggest.category} of ${fmt(amt(biggest))} RWF is ${(amt(biggest) / avg).toFixed(1)}x your typical ${fmt(Math.round(avg))} RWF expense.`,
          suggestion: 'Confirm it was planned. If it repeats monthly, budget for it instead of absorbing it.',
          type: 'warning',
        });
      }
    }

    // 6. Income concentration risk
    if (categoryIncomeData.length > 0 && stats.income > 0) {
      const topIn = categoryIncomeData[0];
      const pct = (topIn.value / stats.income) * 100;
      if (pct > 80 && categoryIncomeData.length <= 2) {
        result.push({
          icon: AlertTriangle,
          title: 'Single income dependency',
          text: `${pct.toFixed(0)}% of income comes from ${topIn.name}.`,
          suggestion: 'Build a second income stream so one disruption does not stop all cash flow.',
          type: 'warning',
        });
      }
    }

    // 7. Spending consistency (volatility)
    if (chartData.length >= 4) {
      const vals = chartData.map(d => Number(d.Expense) || 0);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (mean > 0) {
        const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
        const cv = (sd / mean) * 100;
        result.push({
          icon: BarChart3,
          title: cv > 80 ? 'Spending is very irregular' : 'Spending is fairly steady',
          text: `Daily expenses vary by about ${cv.toFixed(0)}% around a ${fmt(Math.round(mean))} RWF average.`,
          suggestion: cv > 80
            ? 'Irregular spikes make planning hard — spread large purchases or set weekly caps.'
            : 'Predictable spending — a fixed monthly budget will work well for you.',
          type: cv > 80 ? 'warning' : 'success',
        });
      }
    }

    // 8. Budget risk from live budget usage
    if (budgetAlerts.length > 0) {
      const worst = [...budgetAlerts].sort((a, b) => b.pct - a.pct)[0];
      result.push({
        icon: AlertTriangle,
        title: worst.exceeded ? `${worst.category} budget exceeded` : `${worst.category} budget at ${Math.round(worst.pct)}%`,
        text: `${fmt(worst.spent)} RWF used of ${fmt(Number(worst.monthly_limit))} RWF this month${budgetAlerts.length > 1 ? ` (+${budgetAlerts.length - 1} other budget${budgetAlerts.length > 2 ? 's' : ''} at risk)` : ''}.`,
        suggestion: worst.exceeded
          ? 'Pause discretionary spend in this category until next month, or raise the limit deliberately.'
          : 'Slow down here to finish the month inside plan.',
        type: worst.exceeded ? 'critical' : 'warning',
      });
    }

    // 9. Loan exposure
    const pending = (loans ?? []).filter(l => l.status === 'PENDING');
    const oweMe = pending.filter(l => l.type === 'GIVEN').reduce((s, l) => s + Number(l.amount), 0);
    const iOwe = pending.filter(l => l.type === 'RECEIVED').reduce((s, l) => s + Number(l.amount), 0);
    if (oweMe > 0 || iOwe > 0) {
      const heavy = stats.income > 0 && iOwe > stats.income * 0.5;
      result.push({
        icon: HandCoins,
        title: heavy ? 'Debt load is heavy' : 'Open loan positions',
        text: `${fmt(oweMe)} RWF owed to you, ${fmt(iOwe)} RWF owed by you.`,
        suggestion: heavy
          ? 'Debt is over half your income for this range — prioritise repayment before new spending.'
          : oweMe > iOwe
            ? 'Collect the oldest receivable first; unpaid loans behave like frozen cash.'
            : 'Schedule repayments from your surplus so debts do not accumulate interest or strain.',
        type: heavy ? 'critical' : 'info',
      });
    }

    // 10. Activity coverage — records discipline
    const perDay = txData.length / days;
    if (perDay < 0.5 && days >= 7) {
      result.push({
        icon: Lightbulb,
        title: 'Thin record coverage',
        text: `Only ${txData.length} records over ${days} days — some activity is likely unrecorded.`,
        suggestion: 'Record daily, even small cash spend; insights get sharper with complete data.',
        type: 'info',
      });
    }

    const rank = { critical: 0, warning: 1, success: 2, info: 3 } as const;
    return result.sort((a, b) => rank[a.type] - rank[b.type]);
  }, [txData, stats, categoryExpenseData, categoryIncomeData, chartData, budgetAlerts, loans, range]);


  const net = stats.income - stats.expense;

  const loanSummary = useMemo(() => {
    if (!loans) return { oweMe: 0, iOwe: 0 };
    const oweMe = loans.filter(l => l.type === 'GIVEN' && l.status === 'PENDING').reduce((s, l) => s + Number(l.amount), 0);
    const iOwe = loans.filter(l => l.type === 'RECEIVED' && l.status === 'PENDING').reduce((s, l) => s + Number(l.amount), 0);
    return { oweMe, iOwe };
  }, [loans]);

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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard title="Income" value={`${fmt(stats.income)} RWF`} icon={TrendingUp} variant="income" />
        <KPICard title="Expense" value={`${fmt(stats.expense)} RWF`} icon={TrendingDown} variant="expense" />
        <KPICard title="Net Balance" value={`${fmt(net)} RWF`} icon={DollarSign} variant={net >= 0 ? 'income' : 'expense'} />
        <KPICard title="Transactions" value={String(txData?.length ?? 0)} icon={BarChart3} variant="income" />
        <KPICard title="People Owe Me" value={`${fmt(loanSummary.oweMe)} RWF`} icon={HandCoins} variant="expense" />
        <KPICard title="I Owe People" value={`${fmt(loanSummary.iOwe)} RWF`} icon={Wallet} variant="income" />
      </div>

      {/* Analytics Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-accent" /> Smart Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className={cn(
                'flex items-center gap-3 p-3 rounded-lg text-sm',
                insight.type === 'warning' ? 'bg-accent/10 text-accent' : insight.type === 'success' ? 'bg-income/10 text-income' : 'bg-muted text-foreground'
              )}>
                <insight.icon className="w-4 h-4 shrink-0" />
                <span>{insight.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <Card className="border-accent/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-accent flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Budget Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {budgetAlerts.map((b) => (
              <div key={b.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{b.category}</span>
                  <span className={cn('font-semibold', b.exceeded ? 'text-destructive' : 'text-muted-foreground')}>
                    {fmt(b.spent)} / {fmt(Number(b.monthly_limit))} RWF
                    {b.exceeded && ' — EXCEEDED!'}
                  </span>
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

        {/* Expense pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 flex items-center justify-center">
              {categoryExpenseData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No expenses yet</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryExpenseData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                      {categoryExpenseData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmt(v)} RWF`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {categoryExpenseData.slice(0, 5).map((c, i) => (
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

      {/* Income breakdown */}
      {categoryIncomeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryIncomeData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                      {categoryIncomeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmt(v)} RWF`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex flex-col justify-center">
                {categoryIncomeData.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{c.name}</span>
                    </div>
                    <span className="font-medium text-income">{fmt(c.value)} RWF</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
