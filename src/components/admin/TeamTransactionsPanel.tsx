import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenantTransactions } from '@/hooks/useEditRequests';
import { TrendingUp, TrendingDown, ArrowLeftRight, Download, Hash } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-RW');

interface Props {
  /** null = all team members */
  userId: string | null;
  userName?: string;
}

type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export default function TeamTransactionsPanel({ userId, userName }: Props) {
  const { data, isLoading } = useTenantTransactions(userId ?? undefined);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [category, setCategory] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [member, setMember] = useState('ALL');

  const members = useMemo(() => {
    const map: Record<string, string> = {};
    (data ?? []).forEach((t: any) => { map[t.user_id] = t.full_name || t.email || 'User'; });
    return Object.entries(map);
  }, [data]);

  const categories = useMemo(
    () => Array.from(new Set((data ?? []).map((t: any) => t.category).filter(Boolean))) as string[],
    [data],
  );

  const filtered = useMemo(() => {
    const rows = (data ?? []).filter((t: any) => {
      if (type !== 'ALL' && t.type !== type) return false;
      if (category !== 'ALL' && t.category !== category) return false;
      if (!userId && member !== 'ALL' && t.user_id !== member) return false;
      if (from && t.transaction_date < from) return false;
      if (to && t.transaction_date > to) return false;
      if (q && !`${t.category} ${t.description ?? ''} ${t.notes ?? ''} ${t.full_name ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    return rows.sort((a: any, b: any) => {
      if (sort === 'amount_desc') return Number(b.total_amount ?? 0) - Number(a.total_amount ?? 0);
      if (sort === 'amount_asc') return Number(a.total_amount ?? 0) - Number(b.total_amount ?? 0);
      const da = new Date(a.transaction_date).getTime();
      const db = new Date(b.transaction_date).getTime();
      return sort === 'date_asc' ? da - db : db - da;
    });
  }, [data, q, type, category, member, from, to, sort, userId]);

  const stats = useMemo(() => {
    const income = filtered.filter((t: any) => t.type === 'INCOME').reduce((s, t: any) => s + Number(t.total_amount ?? 0), 0);
    const expense = filtered.filter((t: any) => t.type === 'EXPENSE').reduce((s, t: any) => s + Number(t.total_amount ?? 0), 0);
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t: any) => { map[t.category] = (map[t.category] ?? 0) + Number(t.total_amount ?? 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtered]);

  const exportCsv = () => {
    if (filtered.length === 0) return toast.error('Nothing to export');
    const head = ['Date', 'Member', 'Type', 'Category', 'Description', 'Quantity', 'Unit price', 'Total (RWF)', 'Status'];
    const rows = filtered.map((t: any) => [
      t.transaction_date,
      (t.full_name || t.email || '').replace(/,/g, ' '),
      t.type,
      (t.category ?? '').replace(/,/g, ' '),
      (t.description ?? '').replace(/[\n,]/g, ' '),
      t.quantity ?? 1,
      t.unit_price ?? '',
      t.total_amount ?? '',
      t.status ?? '',
    ]);
    const csv = [head, ...rows].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-transactions-${userName ? userName.replace(/\s+/g, '-').toLowerCase() + '-' : ''}${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} records`);
  };

  const maxCat = Math.max(1, ...topCategories.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Income" value={`${fmt(stats.income)} RWF`} tone="income" icon={TrendingUp} />
        <StatCard label="Expense" value={`${fmt(stats.expense)} RWF`} tone="expense" icon={TrendingDown} />
        <StatCard label="Net" value={`${fmt(stats.net)} RWF`} tone={stats.net >= 0 ? 'income' : 'expense'} icon={ArrowLeftRight} />
        <StatCard label="Records" value={String(stats.count)} tone="neutral" icon={Hash} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Input placeholder="Search category, notes, member…" value={q} onChange={e => setQ(e.target.value)} />
        <Select value={type} onValueChange={(v: any) => setType(v)}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {!userId && (
          <Select value={member} onValueChange={setMember}>
            <SelectTrigger><SelectValue placeholder="Member" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All members</SelectItem>
              {members.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Oldest first</SelectItem>
              <SelectItem value="amount_desc">Highest amount</SelectItem>
              <SelectItem value="amount_asc">Lowest amount</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} className="shrink-0">
            <Download className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {topCategories.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Top categories</p>
            {topCategories.map(([c, v]) => (
              <div key={c} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="truncate">{c}</span>
                  <span className="text-muted-foreground">{fmt(v)} RWF</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(v / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No transactions found.</CardContent></Card>
        )}
        {filtered.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={t.type === 'INCOME' ? 'default' : 'destructive'} className="text-[10px]">{t.type}</Badge>
                  <span className="font-medium text-sm break-words">{t.category}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 break-words">
                  {format(new Date(t.transaction_date), 'MMM d, yyyy')}
                  {t.created_at && ` · ${format(new Date(t.created_at), 'h:mm a')}`}
                  {' · '}{t.description || t.notes || '—'}
                </p>
                {!userId && <p className="text-[10px] text-muted-foreground/70">{t.full_name || t.email}</p>}
              </div>
              <div className={`text-left sm:text-right font-semibold whitespace-nowrap ${t.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
                {t.type === 'INCOME' ? '+' : '-'}{fmt(t.total_amount)} <span className="text-xs font-normal text-muted-foreground">RWF</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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
