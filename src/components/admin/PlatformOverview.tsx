import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  Building2, Users, Shield, Bell, KeyRound, TrendingUp, TrendingDown,
  Activity, AlertTriangle, UserPlus, ScrollText,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function PlatformOverview() {
  const [stats, setStats] = useState<any>(null);
  const [pulse, setPulse] = useState<any>(null);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, p, a] = await Promise.all([
        supabase.rpc('admin_global_stats'),
        supabase.rpc('super_admin_platform_pulse'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      if (s.data?.[0]) setStats(s.data[0]);
      if (p.data) setPulse(p.data);
      const rows = a.data ?? [];
      setRecentAudit(rows);
      const ids = Array.from(new Set(rows.map((r: any) => r.actor_user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id,email,full_name').in('user_id', ids as string[]);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((pr: any) => { map[pr.user_id] = pr.full_name || pr.email || pr.user_id.slice(0, 8); });
        setActors(map);
      }
      setLoading(false);
    })();
  }, []);

  const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

  if (loading) return <p className="text-center py-12 text-muted-foreground">Loading overview…</p>;

  return (
    <div className="space-y-6">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Building2} label="Tenants" value={fmt(stats?.total_tenants)} sub={`${fmt(pulse?.new_tenants_7d)} new (7d)`} />
        <Kpi icon={Users} label="Users" value={fmt(stats?.total_users)} sub={`${fmt(pulse?.new_users_7d)} new (7d)`} />
        <Kpi icon={Shield} label="Admins" value={fmt(stats?.total_admins)} />
        <Kpi icon={Activity} label="Transactions" value={fmt(stats?.total_transactions)} sub={`${fmt(pulse?.tx_24h)} in 24h`} />
        <Kpi icon={TrendingUp} label="Total Income" value={`${fmt(stats?.total_income)} RWF`} accent="income" />
        <Kpi icon={TrendingDown} label="Total Expense" value={`${fmt(stats?.total_expense)} RWF`} accent="expense" />
        <Kpi icon={TrendingUp} label="Net Balance" value={`${fmt(stats?.net_balance)} RWF`} accent={Number(stats?.net_balance ?? 0) >= 0 ? 'income' : 'expense'} />
        <Kpi icon={Bell} label="Pending Loans" value={`${fmt(stats?.total_loans_pending)} RWF`} />
      </div>

      {/* Action queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent" /> Action queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Action label="Pending quotas" value={pulse?.pending_quotas} icon={Users} attentive />
            <Action label="Pending resets" value={pulse?.pending_resets} icon={KeyRound} attentive />
            <Action label="Unread alerts" value={pulse?.alerts_unread} icon={Bell} />
            <Action label="Critical alerts 24h" value={pulse?.alerts_critical_24h} icon={AlertTriangle} attentive={(pulse?.alerts_critical_24h ?? 0) > 0} />
            <Action label="Disabled users" value={pulse?.disabled_users} icon={UserPlus} />
            <Action label="Alerts 24h" value={pulse?.alerts_24h} icon={Bell} />
          </div>
        </CardContent>
      </Card>

      {/* Most-alerted tenants */}
      {pulse?.top_alert_tenants?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Most-alerted tenants (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {pulse.top_alert_tenants.map((t: any, i: number) => {
                const max = pulse.top_alert_tenants[0]?.cnt ?? 1;
                const pct = (t.cnt / max) * 100;
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-40 truncate font-medium">{t.business_name ?? '— (no tenant)'}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground">{t.cnt}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent admin activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" /> Recent admin activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">No recent activity.</p>
          ) : (
            <div className="space-y-1.5">
              {recentAudit.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 text-sm border-b pb-1.5 last:border-0">
                  <span className="text-xs text-muted-foreground w-28 shrink-0" title={format(new Date(r.created_at), 'PPpp')}>
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                  <span className="font-medium truncate w-32">{actors[r.actor_user_id] ?? '—'}</span>
                  <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
                  <span className="text-xs text-muted-foreground truncate flex-1">{r.target_type ?? ''}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent }: any) {
  const color = accent === 'income' ? 'bg-income/10 text-income'
    : accent === 'expense' ? 'bg-expense/10 text-expense'
    : 'bg-primary/10 text-primary';
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-base font-bold truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </CardContent></Card>
  );
}

function Action({ icon: Icon, label, value, attentive }: any) {
  const v = Number(value ?? 0);
  const hot = attentive && v > 0;
  return (
    <div className={`rounded-lg p-3 flex items-center gap-2.5 ${hot ? 'bg-accent/10 border border-accent/30' : 'bg-muted/40'}`}>
      <Icon className={`w-4 h-4 ${hot ? 'text-accent' : 'text-muted-foreground'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
        <p className={`text-lg font-bold leading-tight ${hot ? 'text-accent' : ''}`}>{v.toLocaleString()}</p>
      </div>
    </div>
  );
}
