import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useMyTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';
import { RefreshCw, History } from 'lucide-react';

interface Log { id: string; action: string; actor_user_id: string | null; target_id: string | null; metadata: any; created_at: string }

const LABELS: Record<string, { text: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'member.disabled': { text: 'Member disabled', tone: 'destructive' },
  'member.enabled': { text: 'Member enabled', tone: 'default' },
  'member.promoted': { text: 'Promoted to admin', tone: 'default' },
  'member.demoted': { text: 'Changed to user', tone: 'secondary' },
  'member.credentials_reset': { text: 'Login details reset', tone: 'outline' },
  'role.granted': { text: 'Role granted', tone: 'default' },
  'role.revoked': { text: 'Role revoked', tone: 'secondary' },
};

export default function TeamActivity() {
  const { info } = useMyTenant();
  const [logs, setLogs] = useState<Log[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  const load = async () => {
    if (!info?.tenant_id) return;
    setLoading(true);
    const [{ data }, { data: profs }] = await Promise.all([
      supabase.from('audit_logs').select('id,action,actor_user_id,target_id,metadata,created_at')
        .eq('tenant_id', info.tenant_id).order('created_at', { ascending: false }).limit(limit),
      supabase.from('profiles').select('user_id,full_name,email').eq('tenant_id', info.tenant_id),
    ]);
    setLogs((data ?? []) as Log[]);
    const map: Record<string, string> = {};
    (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name || p.email || 'Member'; });
    setNames(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [info?.tenant_id, limit]);

  useEffect(() => {
    if (!info?.tenant_id) return;
    const ch = supabase.channel(`team-activity-${info.tenant_id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs', filter: `tenant_id=eq.${info.tenant_id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.tenant_id]);

  const grouped = useMemo(() => {
    const g: Record<string, Log[]> = {};
    logs.forEach((l) => { const k = format(new Date(l.created_at), 'EEEE, MMM d, yyyy'); (g[k] ??= []).push(l); });
    return Object.entries(g);
  }, [logs]);

  const who = (id: string | null) => (id && names[id]) || (id ? 'Former member' : 'System');

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Team Activity</CardTitle>
          <CardDescription>Every member, role and access change in your team, updated live.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </CardHeader>
      <CardContent>
        {loading && logs.length === 0 ? <p className="text-sm text-muted-foreground">Loading…</p> :
         logs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No team activity recorded yet.</p> : (
          <div className="space-y-5">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{day}</p>
                <ol className="relative border-l border-border ml-1.5 space-y-3">
                  {items.map((l) => {
                    const lab = LABELS[l.action] ?? { text: l.action.replace(/[._]/g, ' '), tone: 'outline' as const };
                    return (
                      <li key={l.id} className="pl-4 relative">
                        <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={lab.tone} className="text-[10px] capitalize">{lab.text}</Badge>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(l.created_at), 'h:mm a')}</span>
                        </div>
                        <p className="text-sm mt-1">
                          <span className="font-medium">{who(l.actor_user_id)}</span>
                          {l.target_id && names[l.target_id] && <> → <span className="font-medium">{names[l.target_id]}</span></>}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
            {logs.length >= limit && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setLimit((n) => n + 50)}>Load more</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
