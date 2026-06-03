import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Users, TrendingUp, TrendingDown, AlertTriangle, Shield, Ban, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [drill, setDrill] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [quotas, setQuotas] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [tRes, dRes, uRes, rRes, aRes, qRes] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', id).maybeSingle(),
        supabase.rpc('tenant_drilldown', { _tenant_id: id }),
        supabase.rpc('admin_list_users'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('alerts').select('*').eq('tenant_id', id).order('created_at', { ascending: false }).limit(50),
        supabase.from('quota_requests').select('*').eq('tenant_id', id).order('created_at', { ascending: false }),
      ]);
      setTenant(tRes.data);
      setDrill(dRes.data);
      setUsers(((uRes.data ?? []) as any[]).filter((u: any) => u.tenant_id === id));
      setRoles((rRes.data ?? []) as any[]);
      setAlerts((aRes.data ?? []) as any[]);
      setQuotas((qRes.data ?? []) as any[]);
      setLoading(false);
    })();
  }, [id]);

  if (authLoading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>;
  if (!isSuperAdmin) { navigate('/'); return null; }
  if (loading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>;
  if (!tenant) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground mb-3">Tenant not found</p>
      <Link to="/admin"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> {t('admin.backToTenants')}</Button></Link>
    </div>
  );

  const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });
  const userRoleMap = new Map<string, string[]>();
  roles.forEach(r => {
    const arr = userRoleMap.get(r.user_id) ?? [];
    arr.push(r.role);
    userRoleMap.set(r.user_id, arr);
  });

  const toggleDisable = async (uid: string, disabled: boolean) => {
    const { error } = await supabase.rpc('admin_set_user_disabled', { _target_user: uid, _disabled: disabled });
    if (error) return toast.error(error.message);
    toast.success(disabled ? 'User disabled' : 'User enabled');
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, is_disabled: disabled } : u));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/admin">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> {t('admin.backToTenants')}</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl"><Building2 className="w-6 h-6 text-primary" />{tenant.business_name}</CardTitle>
              {tenant.tin_number && <p className="text-xs text-muted-foreground mt-1">TIN: {tenant.tin_number}</p>}
              <p className="text-xs text-muted-foreground mt-1">{t('admin.joined')}: {format(new Date(tenant.created_at), 'PPP')}</p>
            </div>
            <Badge variant="outline" className="text-sm">{users.length}/{tenant.max_users} {t('admin.users')}</Badge>
          </div>
        </CardHeader>
      </Card>

      {drill?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={TrendingUp} label={t('common.income')} value={`${fmt(drill.totals.income)} ${t('common.currency')}`} accent="income" />
          <Stat icon={TrendingDown} label={t('common.expense')} value={`${fmt(drill.totals.expense)} ${t('common.currency')}`} accent="expense" />
          <Stat icon={Users} label={t('admin.users')} value={fmt(users.length)} />
          <Stat icon={AlertTriangle} label={t('admin.alerts')} value={fmt(alerts.length)} />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" />{t('admin.tenantUsers')}</CardTitle></CardHeader>
        <CardContent>
          {users.length === 0 ? <p className="text-center text-muted-foreground py-6 text-sm">{t('common.noData')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <tr className="border-b">
                    <th className="py-2 pr-2">{t('common.name')}</th>
                    <th className="py-2 px-2">{t('common.email')}</th>
                    <th className="py-2 px-2">{t('common.phone')}</th>
                    <th className="py-2 px-2">{t('admin.roles')}</th>
                    <th className="py-2 px-2">{t('admin.joined')}</th>
                    <th className="py-2 px-2">{t('common.status')}</th>
                    <th className="py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-2 font-medium">{u.full_name || '—'}</td>
                      <td className="py-2 px-2">{u.email}</td>
                      <td className="py-2 px-2">{u.phone || '—'}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-1">
                          {(userRoleMap.get(u.id) ?? ['user']).map(r => (
                            <Badge key={r} variant={r === 'super_admin' ? 'default' : r === 'admin' ? 'secondary' : 'outline'} className="text-[10px]">
                              <Shield className="w-2.5 h-2.5 mr-0.5" />{r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                      <td className="py-2 px-2">
                        {u.is_disabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="outline" className="text-income">Active</Badge>}
                      </td>
                      <td className="py-2 pl-2">
                        <Button size="sm" variant="ghost" onClick={() => toggleDisable(u.id, !u.is_disabled)} className={u.is_disabled ? 'text-income' : 'text-destructive'}>
                          {u.is_disabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t('admin.pendingQuotas')}</CardTitle></CardHeader>
          <CardContent>
            {quotas.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">{t('common.noData')}</p> : (
              <ul className="space-y-2">
                {quotas.map(q => (
                  <li key={q.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Requested {q.requested_max_users} users</p>
                        {q.reason && <p className="text-xs text-muted-foreground mt-1">{q.reason}</p>}
                      </div>
                      <Badge variant={q.status === 'pending' ? 'secondary' : q.status === 'approved' ? 'default' : 'destructive'}>{q.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(q.created_at), 'PPp')}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{t('admin.alerts')}</CardTitle></CardHeader>
          <CardContent>
            {alerts.length === 0 ? <p className="text-center text-muted-foreground py-4 text-sm">{t('admin.noAlerts')}</p> : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {alerts.map(a => (
                  <li key={a.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        a.severity === 'critical' ? 'bg-destructive' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-primary'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), 'PPp')}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: 'income' | 'expense' }) {
  const color = accent === 'income' ? 'text-income' : accent === 'expense' ? 'text-expense' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted"><Icon className="w-4 h-4 text-muted-foreground" /></div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
          <p className={`text-base font-semibold truncate ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
