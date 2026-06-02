import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ScrollText, RefreshCw, Search, Download } from 'lucide-react';

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
  const [actionFilter, setActionFilter] = useState<string>('all');

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

  const actions = useMemo(() => Array.from(new Set(rows.map(r => r.action))).sort(), [rows]);

  const filtered = rows.filter(r => {
    if (actionFilter !== 'all' && r.action !== actionFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return r.action.toLowerCase().includes(s)
      || (r.target_type ?? '').toLowerCase().includes(s)
      || (r.target_id ?? '').toLowerCase().includes(s)
      || (actors[r.actor_user_id ?? ''] ?? '').toLowerCase().includes(s)
      || JSON.stringify(r.metadata ?? {}).toLowerCase().includes(s);
  });

  const actionColor = (a: string) => {
    if (a.includes('granted') || a.includes('approved') || a.includes('manual_run') && !a.includes('failed')) return 'bg-primary/10 text-primary';
    if (a.includes('revoked') || a.includes('rejected') || a.includes('disabled') || a.includes('failed')) return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  const outcomeOf = (r: AuditRow) => {
    const o = r.metadata?.outcome;
    if (o === 'success') return <Badge variant="outline" className="bg-income/10 text-income border-income/30">success</Badge>;
    if (o === 'failed') return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">failed</Badge>;
    return null;
  };

  const exportCsv = () => {
    const header = ['When', 'Actor', 'Action', 'Target type', 'Target id', 'Outcome', 'Metadata'];
    const lines = [header.join(',')].concat(filtered.map(r => [
      format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
      actors[r.actor_user_id ?? ''] ?? r.actor_user_id ?? '',
      r.action,
      r.target_type ?? '',
      r.target_id ?? '',
      r.metadata?.outcome ?? '',
      JSON.stringify(r.metadata ?? {}).replace(/"/g, '""'),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-logs-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" /> Audit Logs
            <span className="text-xs text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input className="pl-8 w-64" placeholder="Search action / user / details…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />CSV</Button>
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
                  <th className="py-2 px-2">Outcome</th>
                  <th className="py-2 pl-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground" title={format(new Date(r.created_at), 'PPpp')}>
                      {format(new Date(r.created_at), 'MMM d, HH:mm:ss')}
                    </td>
                    <td className="py-1.5 px-2">{actors[r.actor_user_id ?? ''] ?? (r.actor_user_id ? r.actor_user_id.slice(0, 8) : '—')}</td>
                    <td className="py-1.5 px-2"><Badge variant="outline" className={actionColor(r.action)}>{r.action}</Badge></td>
                    <td className="py-1.5 px-2 text-muted-foreground">
                      {r.target_type ?? '—'}{r.target_id ? <span className="text-[10px] block opacity-70">{r.target_id.slice(0, 18)}</span> : null}
                    </td>
                    <td className="py-1.5 px-2">{outcomeOf(r) ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-1.5 pl-2 font-mono text-[10px] text-muted-foreground max-w-xs truncate" title={JSON.stringify(r.metadata ?? {}, null, 2)}>
                      {r.metadata?.request_id && <div className="truncate">req: {String(r.metadata.request_id).slice(0, 8)}…</div>}
                      {r.metadata?.user_agent && <div className="truncate opacity-70">{String(r.metadata.user_agent).slice(0, 40)}</div>}
                      {!r.metadata?.request_id && !r.metadata?.user_agent && (r.metadata && Object.keys(r.metadata).length > 0 ? JSON.stringify(r.metadata) : '—')}
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
