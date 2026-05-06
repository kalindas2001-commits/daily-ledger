import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Search, Building2, Users, TrendingUp, TrendingDown, Eye, Ban, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';

const PALETTE = ['hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(200, 70%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(120, 50%, 40%)', 'hsl(340, 65%, 50%)'];
const PAGE_SIZE = 20;

interface TenantRow {
  tenant_id: string; business_name: string; tin_number: string;
  owner_email: string; owner_full_name: string;
  max_users: number; current_users: number;
  total_income: number; total_expense: number; total_savings: number; total_loans_pending: number;
  last_activity: string | null; created_at: string; total_count: number;
}

export default function TenantsOverview() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [drilldown, setDrilldown] = useState<any>(null);
  const [drillName, setDrillName] = useState<string>('');
  const [drillUsers, setDrillUsers] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const reload = async () => {
    setLoading(true);
    const [list, stats] = await Promise.all([
      supabase.rpc('admin_tenants_overview_paginated', { _limit: PAGE_SIZE, _offset: page * PAGE_SIZE, _search: debounced || null }),
      supabase.rpc('admin_global_stats'),
    ]);
    if (list.error) console.error(list.error); else setRows((list.data ?? []) as TenantRow[]);
    if (!stats.error && stats.data?.[0]) setGlobalStats(stats.data[0]);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [page, debounced]);

  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(totalCount) / PAGE_SIZE));
  const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

  const tenantChart = useMemo(() => rows.map(r => ({
    name: r.business_name.length > 14 ? r.business_name.slice(0, 13) + '…' : r.business_name,
    Income: Number(r.total_income), Expense: Number(r.total_expense),
  })), [rows]);
  const distributionData = useMemo(() => rows.slice(0, 8).map(r => ({
    name: r.business_name, value: Number(r.total_income) + Number(r.total_expense),
  })).filter(x => x.value > 0), [rows]);

  const openDrilldown = async (t: TenantRow) => {
    setDrillName(t.business_name);
    setDrilldown({ loading: true });
    const { data, error } = await supabase.rpc('tenant_drilldown', { _tenant_id: t.tenant_id });
    if (error) { setDrilldown({ error: error.message }); return; }
    setDrilldown(data);
    // Load detailed user list for this tenant
    const { data: users } = await supabase.rpc('admin_list_users');
    setDrillUsers((users ?? []).filter((u: any) => u.tenant_id === t.tenant_id));
  };

  const toggleDisable = async (uid: string, disabled: boolean) => {
    const { error } = await supabase.rpc('admin_set_user_disabled', { _target_user: uid, _disabled: disabled });
    if (error) return toast.error(error.message);
    toast.success(disabled ? 'User disabled' : 'User enabled');
    setDrillUsers(prev => prev.map(u => u.id === uid ? { ...u, is_disabled: disabled } : u));
  };

  return (
    <div className="space-y-6">
      {globalStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Building2} label="Tenants" value={fmt(globalStats.total_tenants)} />
          <StatCard icon={Users} label="Users" value={fmt(globalStats.total_users)} />
          <StatCard icon={TrendingUp} label="Total Income" value={`${fmt(globalStats.total_income)} RWF`} accent="income" />
          <StatCard icon={TrendingDown} label="Total Expense" value={`${fmt(globalStats.total_expense)} RWF`} accent="expense" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top tenants — Income vs Expense (current page)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={tenantChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Legend />
                  <Bar dataKey="Income" fill="hsl(160, 84%, 39%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expense" fill="hsl(0, 72%, 51%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Activity distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              {distributionData.length === 0 ? <p className="text-center text-muted-foreground text-sm pt-12">No data</p> : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={distributionData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                      {distributionData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Tenants ({fmt(totalCount)})</CardTitle>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8 w-64" placeholder="Search business or email…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-center text-muted-foreground py-8">Loading…</p> :
           rows.length === 0 ? <p className="text-center text-muted-foreground py-8">No tenants</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <tr className="border-b">
                    <th className="py-2 pr-2">Business</th><th className="py-2 px-2">Owner</th>
                    <th className="py-2 px-2 text-center">Users</th>
                    <th className="py-2 px-2 text-right">Income</th>
                    <th className="py-2 px-2 text-right">Expense</th>
                    <th className="py-2 px-2 text-right">Savings</th>
                    <th className="py-2 px-2 text-right">Loans</th>
                    <th className="py-2 pl-2">Joined</th><th className="py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.tenant_id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-2">
                        <div className="font-semibold">{r.business_name}</div>
                        {r.tin_number && <div className="text-[10px] text-muted-foreground">TIN: {r.tin_number}</div>}
                      </td>
                      <td className="py-2 px-2">
                        <div>{r.owner_full_name || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{r.owner_email}</div>
                      </td>
                      <td className="py-2 px-2 text-center"><Badge variant="outline">{r.current_users}/{r.max_users}</Badge></td>
                      <td className="py-2 px-2 text-right text-income font-medium">{fmt(r.total_income)}</td>
                      <td className="py-2 px-2 text-right text-expense font-medium">{fmt(r.total_expense)}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmt(r.total_savings)}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmt(r.total_loans_pending)}</td>
                      <td className="py-2 pl-2 text-xs text-muted-foreground">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                      <td className="py-2 pl-2">
                        <Button size="sm" variant="ghost" onClick={() => openDrilldown(r)}><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!drilldown} onOpenChange={(o) => { if (!o) { setDrilldown(null); setDrillUsers([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{drillName}</DialogTitle></DialogHeader>
          {drilldown?.loading ? <p className="text-center py-8 text-muted-foreground">Loading…</p> :
           drilldown?.error ? <p className="text-destructive">{drilldown.error}</p> :
           drilldown && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniStat label="Income" value={`${fmt(drilldown.totals.income)} RWF`} accent="income" />
                <MiniStat label="Expense" value={`${fmt(drilldown.totals.expense)} RWF`} accent="expense" />
                <MiniStat label="Savings" value={`${fmt(drilldown.totals.savings)} RWF`} />
                <MiniStat label="Loans pending" value={`${fmt(drilldown.totals.loans_pending)} RWF`} />
                <MiniStat label="Transactions" value={fmt(drilldown.totals.tx_count)} />
                <MiniStat label="Loans" value={fmt(drilldown.totals.loan_count)} />
                <MiniStat label="Savings accts" value={fmt(drilldown.totals.savings_count)} />
                <MiniStat label="Users" value={fmt(drillUsers.length)} />
              </div>

              {drilldown.monthly_trend?.length > 0 && (
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Monthly trend (12 months)</CardTitle></CardHeader>
                <CardContent><div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={drilldown.monthly_trend}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" fontSize={10} /><YAxis fontSize={10} /><Tooltip />
                      <Bar dataKey="income" fill="hsl(160, 84%, 39%)" />
                      <Bar dataKey="expense" fill="hsl(0, 72%, 51%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div></CardContent></Card>
              )}

              {drillUsers.length > 0 && (
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Users — full details</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground uppercase tracking-wider">
                        <tr className="border-b">
                          <th className="py-1.5 pr-2">Name</th><th className="py-1.5 px-2">Email</th><th className="py-1.5 px-2">Phone</th>
                          <th className="py-1.5 px-2">Joined</th>
                          <th className="py-1.5 px-2 text-right">Tx</th>
                          <th className="py-1.5 px-2 text-right">Income</th>
                          <th className="py-1.5 px-2 text-right">Expense</th>
                          <th className="py-1.5 pl-2">Status</th><th className="py-1.5 pl-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillUsers.map((u) => (
                          <tr key={u.id} className="border-b hover:bg-muted/30">
                            <td className="py-1.5 pr-2 font-medium">{u.full_name || '—'}</td>
                            <td className="py-1.5 px-2">{u.email}</td>
                            <td className="py-1.5 px-2">{u.phone || '—'}</td>
                            <td className="py-1.5 px-2">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                            <td className="py-1.5 px-2 text-right">{fmt(u.tx_count)}</td>
                            <td className="py-1.5 px-2 text-right text-income">{fmt(u.total_income)}</td>
                            <td className="py-1.5 px-2 text-right text-expense">{fmt(u.total_expense)}</td>
                            <td className="py-1.5 pl-2">
                              {u.is_disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="outline" className="text-income">Active</Badge>}
                            </td>
                            <td className="py-1.5 pl-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className={u.is_disabled ? 'text-income' : 'text-destructive'}>
                                    {u.is_disabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{u.is_disabled ? 'Enable account?' : 'Disable account?'}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {u.is_disabled
                                        ? `Allow ${u.email} to sign in again.`
                                        : `${u.email} will be unable to sign in until re-enabled.`}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => toggleDisable(u.id, !u.is_disabled)}>
                                      Confirm
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent === 'income' ? 'bg-income/10 text-income' : accent === 'expense' ? 'bg-expense/10 text-expense' : 'bg-primary/10 text-primary'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-base font-bold truncate">{value}</p>
      </div>
    </CardContent></Card>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: 'income' | 'expense' }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold ${accent === 'income' ? 'text-income' : accent === 'expense' ? 'text-expense' : ''}`}>{value}</p>
    </div>
  );
}
