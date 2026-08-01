import TeamMembers from '@/components/admin/TeamMembers';
import EditRequestsQueue from '@/components/admin/EditRequestsQueue';
import UserTransactionsDrawer from '@/components/admin/UserTransactionsDrawer';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, PencilLine, ListChecks, LayoutDashboard, Eye } from 'lucide-react';
import { useState } from 'react';
import { useTenantTransactions, useTenantEditRequests } from '@/hooks/useEditRequests';

const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-RW');

function TeamOverview({ onOpenAll, onOpenUser }: { onOpenAll: () => void; onOpenUser: (id: string, name: string) => void }) {
  const { data: txs } = useTenantTransactions();
  const { data: requests } = useTenantEditRequests();
  const income = (txs ?? []).filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
  const expense = (txs ?? []).filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
  const byUser: Record<string, { name: string; count: number; income: number; expense: number }> = {};
  (txs ?? []).forEach(t => {
    const key = t.user_id;
    const b = byUser[key] ?? { name: t.full_name || t.email || 'User', count: 0, income: 0, expense: 0 };
    b.count += 1;
    if (t.type === 'INCOME') b.income += Number(t.total_amount ?? 0);
    else b.expense += Number(t.total_amount ?? 0);
    byUser[key] = b;
  });
  const pending = (requests ?? []).filter(r => r.status === 'pending').length;
  const ranked = Object.entries(byUser).sort((a, b) => b[1].count - a[1].count);
  const maxVol = Math.max(1, ...ranked.map(([, b]) => b.income + b.expense));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Team income</p><p className="text-xl font-bold text-income mt-1">{fmt(income)} <span className="text-xs">RWF</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Team expense</p><p className="text-xl font-bold text-expense mt-1">{fmt(expense)} <span className="text-xs">RWF</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Net position</p><p className={`text-xl font-bold mt-1 ${income - expense >= 0 ? 'text-income' : 'text-expense'}`}>{fmt(income - expense)} <span className="text-xs">RWF</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] uppercase text-muted-foreground">Pending edits</p><p className="text-xl font-bold text-primary mt-1">{pending}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">Per-member activity</h4>
            <Button size="sm" variant="outline" onClick={onOpenAll}><Eye className="w-3.5 h-3.5 mr-1" /> View all transactions</Button>
          </div>
          <div className="space-y-2">
            {ranked.map(([uid, b]) => (
              <button
                key={uid}
                onClick={() => onOpenUser(uid, b.name)}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">{b.name}</span>
                  <div className="flex gap-4 text-xs items-center">
                    <span className="text-income">+{fmt(b.income)}</span>
                    <span className="text-expense">-{fmt(b.expense)}</span>
                    <span className="text-muted-foreground">{b.count} tx</span>
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((b.income + b.expense) / maxVol) * 100}%` }} />
                </div>
              </button>
            ))}
            {ranked.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No team transactions yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


export default function TeamPage() {
  const { isAdmin, loading } = useAuth();
  const [allOpen, setAllOpen] = useState(false);
  const [focus, setFocus] = useState<{ id: string; name: string } | null>(null);
  const { data: requests } = useTenantEditRequests();
  const pendingCount = (requests ?? []).filter((r: any) => r.status === 'pending').length;
  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Team Management</h2>
      </div>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview"><LayoutDashboard className="w-4 h-4 mr-1.5" /> Overview</TabsTrigger>
          <TabsTrigger value="members"><Users className="w-4 h-4 mr-1.5" /> Members</TabsTrigger>
          <TabsTrigger value="edits" className="relative">
            <PencilLine className="w-4 h-4 mr-1.5" /> Edits
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions"><ListChecks className="w-4 h-4 mr-1.5" /> Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <TeamOverview onOpenAll={() => setAllOpen(true)} onOpenUser={(id, name) => setFocus({ id, name })} />
        </TabsContent>
        <TabsContent value="members" className="mt-4"><TeamMembers /></TabsContent>
        <TabsContent value="edits" className="mt-4"><EditRequestsQueue /></TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <Card><CardContent className="p-4">
            <Button onClick={() => setAllOpen(true)}><Eye className="w-4 h-4 mr-1" /> Open all team transactions</Button>
            <p className="text-xs text-muted-foreground mt-2">View, filter and audit every transaction recorded by your team members.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
      <UserTransactionsDrawer open={allOpen} onOpenChange={setAllOpen} userId={null} userName="Team" />
      <UserTransactionsDrawer
        open={!!focus}
        onOpenChange={(o) => { if (!o) setFocus(null); }}
        userId={focus?.id ?? null}
        userName={focus?.name}
      />
    </div>
  );

}
