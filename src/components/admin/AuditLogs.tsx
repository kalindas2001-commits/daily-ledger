import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ScrollText, RefreshCw, Search } from 'lucide-react';

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_user_id: string | null;
  tenant_id: string | null;
  metadata: any;
}

export default function AuditLogs() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from('audit_logs')
      .select('*').order('created_at', { ascending: false }).limit(500);
    setRows((data ?? []) as AuditRow[]);
    const ids = Array.from(new Set((data ?? []).map((r: any) => r.actor_user_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id,email,full_name').in('user_id', ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name || p.email || p.user_id.slice(0, 8); });
      setActors(map);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const filtered = rows.filter(r =>
    !search ||
    r.action.toLowerCase().includes(search.toLowerCase()) ||
    (r.target_type ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (actors[r.actor_user_id ?? ''] ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const actionColor = (a: string) => {
    if (a.includes('granted') || a.includes('approved')) return 'bg-primary/10 text-primary';
    if (a.includes('revoked') || a.includes('rejected') || a.includes('disabled')) return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" /> Audit Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8 w-64" placeholder="Filter action/user…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-6">Loading…</p> :
         filtered.length === 0 ? <p className="text-center text-muted-foreground py-6">No audit entries.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground uppercase tracking-wider">
                <tr className="border-b">
                  <th className="py-2 pr-2">When</th>
                  <th className="py-2 px-2">Actor</th>
                  <th className="py-2 px-2">Action</th>
                  <th className="py-2 px-2">Target</th>
                  <th className="py-2 pl-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{format(new Date(r.created_at), 'MMM d, HH:mm')}</td>
                    <td className="py-1.5 px-2">{actors[r.actor_user_id ?? ''] ?? (r.actor_user_id ? r.actor_user_id.slice(0, 8) : '—')}</td>
                    <td className="py-1.5 px-2"><Badge variant="outline" className={actionColor(r.action)}>{r.action}</Badge></td>
                    <td className="py-1.5 px-2 text-muted-foreground">{r.target_type ?? '—'}</td>
                    <td className="py-1.5 pl-2 font-mono text-[10px] text-muted-foreground max-w-xs truncate">
                      {r.metadata ? JSON.stringify(r.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
