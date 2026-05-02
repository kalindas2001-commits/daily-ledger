import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Wallet, Filter, Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { toast } from 'sonner';

interface FilteredTx {
  transaction_date: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  total_amount: number;
  user_id: string;
}

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n)) + ' RWF';
const COLORS = ['#0d9668', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function AdminAnalytics() {
  const [startDate, setStartDate] = useState<string>(daysAgo(30));
  const [endDate, setEndDate] = useState<string>(today());
  const [type, setType] = useState<string>('ALL');
  const [category, setCategory] = useState<string>('ALL');
  const [data, setData] = useState<FilteredTx[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase.rpc('admin_filtered_transactions', {
      _start_date: startDate || null,
      _end_date: endDate || null,
      _type: type === 'ALL' ? null : type,
      _category: category === 'ALL' ? null : category,
    });
    if (error) toast.error(error.message);
    else setData((rows ?? []) as FilteredTx[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Derive available categories from a no-category-filter pull (use current data list as a proxy)
  const allCategories = useMemo(() => {
    const set = new Set<string>(data.map((d) => d.category));
    return Array.from(set).sort();
  }, [data]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    data.forEach((t) => {
      const a = Number(t.total_amount) || 0;
      if (t.type === 'INCOME') income += a; else expense += a;
    });
    return { income, expense, net: income - expense, count: data.length };
  }, [data]);

  // Time series by day
  const timeSeries = useMemo(() => {
    const map = new Map<string, { date: string; income: number; expense: number }>();
    data.forEach((t) => {
      const k = t.transaction_date;
      const e = map.get(k) ?? { date: k, income: 0, expense: 0 };
      const a = Number(t.total_amount) || 0;
      if (t.type === 'INCOME') e.income += a; else e.expense += a;
      map.set(k, e);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Category breakdown
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((t) => {
      map.set(t.category, (map.get(t.category) ?? 0) + (Number(t.total_amount) || 0));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" /> Analytics & drill-down
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">From</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">To</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {allCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={load} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
        </div>

        {/* Totals strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat icon={TrendingUp} label="Income" value={fmt(totals.income)} color="text-emerald-600" />
          <Stat icon={TrendingDown} label="Expense" value={fmt(totals.expense)} color="text-rose-600" />
          <Stat icon={Wallet} label="Net" value={fmt(totals.net)} color={totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          <Stat icon={Filter} label="Records" value={String(totals.count)} color="text-foreground" />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Daily trend</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="income" stroke="#0d9668" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Top categories</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border p-3 lg:col-span-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Category share</div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Drill-down table + CSV */}
        <DrillDownTable rows={data} />
      </CardContent>
    </Card>
  );
}

function DrillDownTable({ rows }: { rows: FilteredTx[] }) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [rows]
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const header = ['Date', 'Type', 'Category', 'Amount (RWF)', 'User ID'];
    const lines = [header.join(',')];
    for (const r of sorted) {
      const cells = [
        r.transaction_date,
        r.type,
        `"${(r.category ?? '').replace(/"/g, '""')}"`,
        Math.round(Number(r.total_amount) || 0),
        r.user_id,
      ];
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cungacash-admin-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="text-sm font-semibold">
          Matching transactions <span className="text-muted-foreground font-normal">({sorted.length})</span>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={sorted.length === 0}>
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Category</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-left p-2 hidden md:table-cell">User</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No transactions match.</td></tr>
            )}
            {pageRows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 whitespace-nowrap">{r.transaction_date}</td>
                <td className="p-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    r.type === 'INCOME' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'
                  }`}>{r.type}</span>
                </td>
                <td className="p-2">{r.category}</td>
                <td className={`p-2 text-right tabular-nums font-medium ${
                  r.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                }`}>{fmt(Number(r.total_amount))}</td>
                <td className="p-2 text-xs text-muted-foreground hidden md:table-cell font-mono">
                  {r.user_id.slice(0, 8)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2 border-t text-xs">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className={`text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}
