import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { KeyRound, Check, X, Copy, RefreshCw } from 'lucide-react';

interface ResetReq {
  id: string; user_id: string; email: string; phone: string;
  status: 'pending' | 'approved' | 'used' | 'rejected';
  reset_code: string | null; expires_at: string | null;
  attempt_count: number; created_at: string; reviewed_at: string | null;
  full_name: string;
}

export default function PasswordResetRequests() {
  const [rows, setRows] = useState<ResetReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeDialog, setCodeDialog] = useState<{ code: string; email: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('super_admin_list_reset_requests');
    if (error) toast.error(error.message);
    else setRows((data ?? []) as ResetReq[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const approve = async (id: string, email: string) => {
    setBusy(id);
    const { data, error } = await supabase.rpc('super_admin_approve_reset', { _request_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    setCodeDialog({ code: data as string, email });
    reload();
  };

  const reject = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc('super_admin_reject_reset', { _request_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Request rejected');
    reload();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-accent/10 text-accent',
      approved: 'bg-primary/10 text-primary',
      used: 'bg-muted text-muted-foreground',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return <Badge variant="outline" className={map[s]}>{s}</Badge>;
  };

  const pending = rows.filter(r => r.status === 'pending');
  const others = rows.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> Password Reset Requests
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-center text-muted-foreground py-6">Loading…</p> :
           rows.length === 0 ? <p className="text-center text-muted-foreground py-6">No reset requests yet.</p> : (
            <>
              {pending.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pending ({pending.length})</p>
                  <div className="space-y-2">
                    {pending.map(r => (
                      <div key={r.id} className="border border-accent/30 bg-accent/5 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{r.full_name || r.email}</div>
                          <div className="text-xs text-muted-foreground">{r.email} · {r.phone}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Requested {format(new Date(r.created_at), 'MMM d, HH:mm')}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busy === r.id} onClick={() => approve(r.id, r.email)}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => reject(r.id)}>
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {others.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">History</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground uppercase">
                        <tr className="border-b">
                          <th className="py-1.5 pr-2">User</th><th className="py-1.5 px-2">Email</th>
                          <th className="py-1.5 px-2">Status</th><th className="py-1.5 px-2">Code</th>
                          <th className="py-1.5 px-2">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {others.map(r => (
                          <tr key={r.id} className="border-b">
                            <td className="py-1.5 pr-2">{r.full_name || '—'}</td>
                            <td className="py-1.5 px-2">{r.email}</td>
                            <td className="py-1.5 px-2">{statusBadge(r.status)}</td>
                            <td className="py-1.5 px-2 font-mono">{r.status === 'approved' ? r.reset_code : '—'}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{format(new Date(r.created_at), 'MMM d, HH:mm')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!codeDialog} onOpenChange={(o) => { if (!o) setCodeDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset code generated</DialogTitle>
            <DialogDescription>
              Share this code with <span className="font-medium">{codeDialog?.email}</span>. It expires in 15 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-3xl font-mono font-bold tracking-widest text-primary">{codeDialog?.code}</p>
          </div>
          <Button onClick={() => {
            navigator.clipboard.writeText(codeDialog?.code ?? '');
            toast.success('Code copied');
          }}>
            <Copy className="w-4 h-4 mr-2" /> Copy code
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
