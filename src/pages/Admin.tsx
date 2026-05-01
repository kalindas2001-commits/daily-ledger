import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Users, Shield, TrendingUp, TrendingDown, Wallet, HandCoins, UserPlus, Ban, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import AdminAnalytics from '@/components/AdminAnalytics';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_disabled: boolean;
  tx_count: number;
  total_income: number;
  total_expense: number;
}

interface GlobalStats {
  total_users: number;
  total_transactions: number;
  total_income: number;
  total_expense: number;
  net_balance: number;
  total_loans_pending: number;
}

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n)) + ' RWF';

export default function Admin() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: usersData, error: uErr }, { data: statsData, error: sErr }] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.rpc('admin_global_stats'),
    ]);
    if (uErr) toast.error(uErr.message); else setUsers((usersData as AdminUser[]) ?? []);
    if (sErr) toast.error(sErr.message); else setStats(((statsData as GlobalStats[]) ?? [])[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const handleCreate = async () => {
    const username = newUsername.trim().toLowerCase();
    if (!username || newPassword.length < 6) {
      toast.error('Username required, password ≥ 6 chars');
      return;
    }
    setCreating(true);
    const { error } = await supabase.auth.signUp({
      email: `${username}@fintracker.local`,
      password: newPassword,
      options: { emailRedirectTo: window.location.origin },
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`User ${username} created`);
    setNewUsername(''); setNewPassword(''); setCreateOpen(false);
    setTimeout(load, 600);
  };

  const handleToggleDisabled = async (target: AdminUser) => {
    const { error } = await supabase.rpc('admin_set_user_disabled', {
      _target_user: target.id,
      _disabled: !target.is_disabled,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(target.is_disabled ? 'User enabled' : 'User disabled');
    load();
  };

  const kpis = [
    { label: 'Users', value: stats?.total_users ?? 0, icon: Users, fmt: (v: number) => String(v) },
    { label: 'Transactions', value: stats?.total_transactions ?? 0, icon: Wallet, fmt: (v: number) => String(v) },
    { label: 'Total Income', value: stats?.total_income ?? 0, icon: TrendingUp, fmt },
    { label: 'Total Expense', value: stats?.total_expense ?? 0, icon: TrendingDown, fmt },
    { label: 'Net Balance', value: stats?.net_balance ?? 0, icon: Wallet, fmt },
    { label: 'Pending Loans', value: stats?.total_loans_pending ?? 0, icon: HandCoins, fmt },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Admin Console</h2>
          <Badge variant="secondary">Global view</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> New User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input placeholder="username (lowercase)" value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)} autoFocus />
                <Input type="password" placeholder="password (≥ 6 chars)" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Email will be: {newUsername.trim().toLowerCase() || 'username'}@fintracker.local
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{k.label}</span>
                <k.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-lg font-bold">{k.fmt(k.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Drill-down analytics with filters */}
      <AdminAnalytics />

      {/* Users table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Users ({users.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3 hidden sm:table-cell">Last Sign-in</th>
                  <th className="text-right p-3">Tx</th>
                  <th className="text-right p-3 hidden md:table-cell">Income</th>
                  <th className="text-right p-3 hidden md:table-cell">Expense</th>
                  <th className="text-center p-3">Status</th>
                  <th className="text-right p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!loading && users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3 text-right tabular-nums">{u.tx_count}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-600 hidden md:table-cell">{fmt(Number(u.total_income))}</td>
                    <td className="p-3 text-right tabular-nums text-rose-600 hidden md:table-cell">{fmt(Number(u.total_expense))}</td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {u.is_admin && <Badge className="text-[10px]">admin</Badge>}
                        {u.is_disabled
                          ? <Badge variant="destructive" className="text-[10px]">disabled</Badge>
                          : <Badge variant="outline" className="text-[10px]">active</Badge>}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {u.id === user?.id ? (
                        <span className="text-xs text-muted-foreground">you</span>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant={u.is_disabled ? 'outline' : 'destructive'}>
                              {u.is_disabled ? <><Check className="w-3.5 h-3.5 mr-1" />Enable</> : <><Ban className="w-3.5 h-3.5 mr-1" />Disable</>}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{u.is_disabled ? 'Enable' : 'Disable'} {u.username}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.is_disabled
                                  ? 'They will be able to sign in again.'
                                  : 'They will no longer be able to sign in. Their data is preserved.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleToggleDisabled(u)}>Confirm</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
