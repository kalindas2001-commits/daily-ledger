import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDailySummaries, useTransactions } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function quantileColor(value: number, values: number[]): string {
  if (values.length === 0 || value === 0) return '';
  const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const idx = sorted.findIndex(v => v >= value);
  const pct = idx / sorted.length;
  if (pct <= 0.25) return 'bg-expense/10';
  if (pct <= 0.5) return 'bg-expense/20';
  if (pct <= 0.75) return 'bg-expense/30';
  return 'bg-expense/40';
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: summaries } = useDailySummaries(monthStart, monthEnd);
  const { data: dayTx } = useTransactions(selectedDate ? { from: selectedDate, to: selectedDate } : undefined);

  const summaryMap = useMemo(() => {
    const map: Record<string, { income: number; expense: number; net: number }> = {};
    summaries?.forEach((s) => {
      map[s.summary_date] = { income: s.total_income ?? 0, expense: s.total_expense ?? 0, net: s.net_balance ?? 0 };
    });
    return map;
  }, [summaries]);

  const allExpenses = useMemo(() => {
    return Object.values(summaryMap).map(s => s.expense);
  }, [summaryMap]);

  // Monthly totals
  const monthTotals = useMemo(() => {
    let income = 0, expense = 0;
    Object.values(summaryMap).forEach(s => { income += s.income; expense += s.expense; });
    return { income, expense, net: income - expense };
  }, [summaryMap]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = getDay(startOfMonth(currentMonth));
  const blanks = (startDay === 0 ? 6 : startDay - 1);

  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      {/* Month summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-income/5 border-income/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Income</p>
            <p className="text-sm sm:text-base font-bold text-income">{fmt(monthTotals.income)}</p>
          </CardContent>
        </Card>
        <Card className="bg-expense/5 border-expense/20">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Expense</p>
            <p className="text-sm sm:text-base font-bold text-expense">{fmt(monthTotals.expense)}</p>
          </CardContent>
        </Card>
        <Card className={monthTotals.net >= 0 ? 'bg-income/5 border-income/20' : 'bg-expense/5 border-expense/20'}>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Net</p>
            <p className={cn('text-sm sm:text-base font-bold', monthTotals.net >= 0 ? 'text-income' : 'text-expense')}>{fmt(monthTotals.net)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: blanks }).map((_, i) => <div key={`b-${i}`} />)}
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const summary = summaryMap[dateStr];
              const hasData = !!summary;
              const heatClass = summary ? quantileColor(summary.expense, allExpenses) : '';

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'relative p-1 rounded-lg text-left transition-colors min-h-[56px] sm:min-h-[72px] hover:bg-muted',
                    isToday(day) && 'ring-2 ring-primary',
                    heatClass,
                    !heatClass && hasData && summary.net > 0 && 'bg-income/10',
                    !heatClass && hasData && summary.net < 0 && 'bg-expense/10'
                  )}
                >
                  <span className={cn('text-xs font-medium', isToday(day) && 'text-primary')}>
                    {format(day, 'd')}
                  </span>
                  {hasData && (
                    <div className="mt-0.5 space-y-0.5">
                      <div className="text-[10px] text-income truncate">+{fmt(summary.income)}</div>
                      <div className="text-[10px] text-expense truncate">-{fmt(summary.expense)}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Heatmap legend */}
          <div className="flex items-center gap-2 mt-4 justify-center text-[10px] text-muted-foreground">
            <span>Low spend</span>
            <div className="flex gap-0.5">
              <div className="w-4 h-4 rounded bg-expense/10" />
              <div className="w-4 h-4 rounded bg-expense/20" />
              <div className="w-4 h-4 rounded bg-expense/30" />
              <div className="w-4 h-4 rounded bg-expense/40" />
            </div>
            <span>High spend</span>
          </div>
        </CardContent>
      </Card>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDate && format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</DialogTitle>
          </DialogHeader>
          {selectedDate && summaryMap[selectedDate] && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-income/10 p-3 text-center">
                <p className="text-xs text-muted-foreground">Income</p>
                <p className="font-bold text-income">{fmt(summaryMap[selectedDate].income)}</p>
              </div>
              <div className="rounded-lg bg-expense/10 p-3 text-center">
                <p className="text-xs text-muted-foreground">Expense</p>
                <p className="font-bold text-expense">{fmt(summaryMap[selectedDate].expense)}</p>
              </div>
              <div className={cn('rounded-lg p-3 text-center', summaryMap[selectedDate].net >= 0 ? 'bg-income/10' : 'bg-expense/10')}>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className={cn('font-bold', summaryMap[selectedDate].net >= 0 ? 'text-income' : 'text-expense')}>
                  {fmt(summaryMap[selectedDate].net)}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {dayTx?.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <p className="text-sm font-medium">{tx.category}</p>
                  {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                </div>
                <span className={cn('font-semibold text-sm', tx.type === 'INCOME' ? 'text-income' : 'text-expense')}>
                  {tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.total_amount ?? 0)}
                </span>
              </div>
            ))}
            {(!dayTx || dayTx.length === 0) && (
              <p className="text-center text-muted-foreground text-sm py-4">No transactions for this day</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
