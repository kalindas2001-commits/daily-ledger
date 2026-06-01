import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, ShieldCheck, ShieldOff, Search, Crown, RefreshCw } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  business_name: string;
  is_admin: boolean;
  is_disabled: boolean;
  tenant_id: string | null;
}

export default function RoleManagement() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [superIds, setSuperIds] = useState<Set<string>>(new Set());

  const reload = async () => {
    setLoading(true);
    const [u, sa] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.from('user_roles').select('user_id').eq('role', 'super_admin'),
    ]);
    if (u.error) toast.error(u.error.message);
    else setRows((u.data ?? []) as UserRow[]);
    setSuperIds(new Set((sa.data ?? []).map((r: any) => r.user_id)));
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const change = async (target: string, role: 'admin' | 'super_admin' | 'user', revoke: boolean) => {
    const rpc = revoke ? 'admin_revoke_role' : 'admin_promote_user';
    const { error } = await supabase.rpc(rpc, { _target: target, _role: role });
    if (error) return toast.error(error.message);
    toast.success(revoke ? `Revoked ${role}` : `Granted ${role}`);
    reload();
  };

  const filtered = rows.filter(r =>
    !search ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.business_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Role Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8 w-64" placeholder="Search user…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-6">Loading…</p> :
         filtered.length === 0 ? <p className="text-center text-muted-foreground py-6">No users.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                <tr className="border-b">
                  <th className="py-2 pr-2">User</th>
                  <th className="py-2 px-2">Tenant</th>
                  <th className="py-2 px-2">Roles</th>
                  <th className="py-2 pl-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isSuper = superIds.has(u.id);
                  return (
                    <tr key={u.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{u.full_name || '—'}</div>
                        <div className="text-[11px] text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="py-2 px-2 text-xs">{u.business_name || '—'}</td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1 flex-wrap">
                          {isSuper && <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline"><Crown className="w-3 h-3 mr-1" /> super_admin</Badge>}
                          {u.is_admin && !isSuper && <Badge variant="outline"><ShieldCheck className="w-3 h-3 mr-1" /> admin</Badge>}
                          {!u.is_admin && !isSuper && <Badge variant="outline" className="text-muted-foreground">user</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pl-2">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {!u.is_admin && (
                            <ConfirmBtn label="Make admin" icon={<ShieldCheck className="w-3.5 h-3.5" />}
                              title={`Promote ${u.email} to admin?`}
                              desc="Admin can manage their tenant's users and data."
                              onConfirm={() => change(u.id, 'admin', false)} />
                          )}
                          {u.is_admin && !isSuper && (
                            <ConfirmBtn label="Revoke admin" icon={<ShieldOff className="w-3.5 h-3.5" />} variant="outline"
                              title={`Revoke admin from ${u.email}?`}
                              desc="They will lose admin privileges."
                              onConfirm={() => change(u.id, 'admin', true)} />
                          )}
                          {!isSuper && (
                            <ConfirmBtn label="Make super" icon={<Crown className="w-3.5 h-3.5" />} variant="outline"
                              title={`Promote ${u.email} to SUPER ADMIN?`}
                              desc="Super admin can access all tenants and system-wide controls."
                              onConfirm={() => change(u.id, 'super_admin', false)} />
                          )}
                          {isSuper && (
                            <ConfirmBtn label="Revoke super" icon={<ShieldOff className="w-3.5 h-3.5" />} variant="outline"
                              title={`Revoke super_admin from ${u.email}?`}
                              desc="They will lose system-wide access."
                              onConfirm={() => change(u.id, 'super_admin', true)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConfirmBtn({ label, icon, title, desc, onConfirm, variant }: any) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant ?? 'secondary'}>{icon}<span className="ml-1 hidden sm:inline">{label}</span></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
