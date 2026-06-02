import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Activity, RefreshCw, PlayCircle, Clock, AlertTriangle, CheckCircle2,
  XCircle, Bell, TrendingUp, Building2, UserPlus, KeyRound, Users, History,
} from 'lucide-react';

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_started: string | null;
  last_run_finished: string | null;
  last_status: string | null;
  last_return_message: string | null;
  total_runs: number;
  failed_runs: number;
}

interface Pulse {
  alerts_24h: number;
  alerts_critical_24h: number;
  alerts_unread: number;
  tx_24h: number;
  new_tenants_7d: number;
  new_users_7d: number;
  pending_quotas: number;
  pending_resets: number;
  disabled_users: number;
  top_alert_tenants: { business_name: string | null; cnt: number }[];
}

export default function SystemHealth() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const reload = async () => {
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.rpc('super_admin_cron_status'),
      supabase.rpc('super_admin_platform_pulse'),
    ]);
    if (c.error) toast.error(c.error.message); else setJobs((c.data ?? []) as CronJob[]);
    if (!p.error) setPulse(p.data as unknown as Pulse);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const retryAlertAnalyzer = async (name: string) => {
    setRetrying(name);
    const startedAt = new Date().toISOString();
    const requestId = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { data, error } = await supabase.functions.invoke('ai-alert-analyzer', {
      body: {},
      headers: { 'x-request-id': requestId },
    });
    setRetrying(null);
    // Audit trail for manual run — include client request metadata
    await supabase.rpc('super_admin_log_action', {
      _action: error ? 'cron.manual_run_failed' : 'cron.manual_run',
      _target_type: 'cron_job',
      _target_id: name,
      _metadata: {
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        outcome: error ? 'failed' : 'success',
        error: error?.message ?? null,
        inserted: data?.inserted ?? null,
        request_id: requestId,
        user_agent: navigator.userAgent,
        page_url: window.location.href,
      } as any,
    });
    if (error) return toast.error(`Run failed: ${error.message}`);
    toast.success(`Manual run completed${data?.inserted != null ? ` — ${data.inserted} alerts inserted` : ''}`);
    setTimeout(reload, 1500);
  };

  const openHistory = async (j: CronJob) => {
    setHistoryJob(j);
    setHistory([]);
    const { data, error } = await supabase.rpc('super_admin_cron_history', { _jobid: j.jobid, _limit: 30 });
    if (error) toast.error(error.message);
    else setHistory(data ?? []);
  };

  const statusIcon = (s: string | null) => {
    if (s === 'succeeded') return <CheckCircle2 className="w-4 h-4 text-income" />;
    if (s === 'failed') return <XCircle className="w-4 h-4 text-destructive" />;
    if (s === 'running' || s === 'starting' || s === 'sending') return <Activity className="w-4 h-4 text-accent animate-pulse" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      {/* Platform pulse */}
      {pulse && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <PulseCard icon={Bell} label="Alerts 24h" value={pulse.alerts_24h} sub={`${pulse.alerts_critical_24h} critical`} accent={pulse.alerts_critical_24h > 0 ? 'expense' : undefined} />
          <PulseCard icon={Bell} label="Unread alerts" value={pulse.alerts_unread} />
          <PulseCard icon={TrendingUp} label="Tx last 24h" value={pulse.tx_24h} />
          <PulseCard icon={Building2} label="New tenants 7d" value={pulse.new_tenants_7d} />
          <PulseCard icon={UserPlus} label="New users 7d" value={pulse.new_users_7d} />
          <PulseCard icon={Users} label="Pending quotas" value={pulse.pending_quotas} accent={pulse.pending_quotas > 0 ? 'accent' : undefined} />
          <PulseCard icon={KeyRound} label="Pending resets" value={pulse.pending_resets} accent={pulse.pending_resets > 0 ? 'accent' : undefined} />
          <PulseCard icon={XCircle} label="Disabled users" value={pulse.disabled_users} />
        </div>
      )}

      {/* Cron jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Scheduled Jobs
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-center text-muted-foreground py-6">Loading…</p> :
           jobs.length === 0 ? <p className="text-center text-muted-foreground py-6">No scheduled jobs.</p> : (
            <div className="space-y-2">
              {jobs.map(j => {
                const isAi = j.jobname.includes('alert-analyzer') || j.jobname.includes('ai-alert');
                const stale = j.last_run_started && (Date.now() - new Date(j.last_run_started).getTime()) > 2 * 60 * 60 * 1000;
                return (
                  <div key={j.jobid} className="border rounded-lg p-3 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{j.jobname}</span>
                        {j.active ? <Badge variant="outline" className="bg-income/10 text-income border-income/30">Active</Badge>
                                  : <Badge variant="outline" className="bg-muted text-muted-foreground">Paused</Badge>}
                        <Badge variant="outline" className="font-mono text-[10px]">{j.schedule}</Badge>
                        {stale && <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30"><AlertTriangle className="w-3 h-3 mr-1" />Stale</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">{statusIcon(j.last_status)} {j.last_status ?? 'never run'}</span>
                        {j.last_run_started && (
                          <span title={format(new Date(j.last_run_started), 'PPpp')}>
                            Last run {formatDistanceToNow(new Date(j.last_run_started), { addSuffix: true })}
                          </span>
                        )}
                        <span>{j.total_runs} runs · <span className={j.failed_runs > 0 ? 'text-destructive' : ''}>{j.failed_runs} failed</span></span>
                      </div>
                      {j.last_return_message && j.last_status !== 'succeeded' && (
                        <div className="mt-1.5 text-[11px] font-mono text-destructive truncate">{j.last_return_message}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openHistory(j)}>
                        <History className="w-3.5 h-3.5 mr-1" /> History
                      </Button>
                      {isAi && (
                        <Button size="sm" disabled={retrying === j.jobname} onClick={() => retryAlertAnalyzer(j.jobname)}>
                          <PlayCircle className="w-3.5 h-3.5 mr-1" />
                          {retrying === j.jobname ? 'Running…' : 'Run now'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top alert tenants */}
      {pulse && pulse.top_alert_tenants.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent" /> Most-alerted tenants (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {pulse.top_alert_tenants.map((t, i) => {
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

      {/* History dialog */}
      <Dialog open={!!historyJob} onOpenChange={(o) => { if (!o) { setHistoryJob(null); setHistory([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{historyJob?.jobname} — recent runs</DialogTitle></DialogHeader>
          {history.length === 0 ? <p className="text-center py-6 text-muted-foreground text-sm">No history yet.</p> : (
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground uppercase tracking-wider">
                <tr className="border-b">
                  <th className="py-1.5 pr-2">Start</th>
                  <th className="py-1.5 px-2">Duration</th>
                  <th className="py-1.5 px-2">Status</th>
                  <th className="py-1.5 pl-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => {
                  const dur = h.end_time && h.start_time
                    ? `${Math.round((new Date(h.end_time).getTime() - new Date(h.start_time).getTime()) / 100) / 10}s`
                    : '—';
                  return (
                    <tr key={h.runid} className="border-b">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{format(new Date(h.start_time), 'MMM d HH:mm:ss')}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{dur}</td>
                      <td className="py-1.5 px-2">
                        <span className="inline-flex items-center gap-1">{statusIcon(h.status)} {h.status}</span>
                      </td>
                      <td className="py-1.5 pl-2 font-mono text-[10px] text-muted-foreground max-w-md truncate" title={h.return_message ?? ''}>
                        {h.return_message ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PulseCard({ icon: Icon, label, value, sub, accent }: any) {
  const color = accent === 'expense' ? 'bg-destructive/10 text-destructive'
    : accent === 'accent' ? 'bg-accent/10 text-accent'
    : 'bg-primary/10 text-primary';
  return (
    <Card><CardContent className="p-3 flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
        <p className="text-lg font-bold leading-tight">{Number(value ?? 0).toLocaleString()}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </CardContent></Card>
  );
}
