import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Check, X, RefreshCw, Users } from 'lucide-react';

interface QuotaReq {
  id: string;
  tenant_id: string;
  requested_by: string;
  requested_max_users: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  business_name?: string;
  owner_email?: string;
}

export default function QuotaRequests() {
  const [rows, setRows] = useState<QuotaReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quota_requests')
      .select('*, tenants(business_name, owner_user_id)')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else {
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        business_name: r.tenants?.business_name ?? '—',
      })) as QuotaReq[];
      setRows(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc('admin_review_quota_request', { _request_id: id, _approve: approve });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? 'Quota approved' : 'Quota rejected');
    reload();
  };

  const pending = rows.filter(r => r.status === 'pending');
  const history = rows.filter(r => r.status !== 'pending');

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-accent/10 text-accent',
      approved: 'bg-primary/10 text-primary',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return <Badge variant="outline" className={map[s]}>{s}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Quota Requests
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="w-4 h-4" /></Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-center text-muted-foreground py-6">Loading…</p> :
         rows.length === 0 ? <p className="text-center text-muted-foreground py-6">No quota requests.</p> : (
          <>
            {pending.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pending ({pending.length})</p>
                <div className="space-y-2">
                  {pending.map(r => (
                    <div key={r.id} className="border border-accent/30 bg-accent/5 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{r.business_name}</div>
                        <div className="text-xs text-muted-foreground">Requesting <strong>{r.requested_max_users}</strong> max users</div>
                        {r.reason && <div className="text-xs italic mt-1">"{r.reason}"</div>}
                        <div className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(r.created_at), 'MMM d, HH:mm')}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy === r.id} onClick={() => review(r.id, true)}>
                          <Check className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => review(r.id, false)}>
                          <X className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {history.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">History</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground uppercase">
                      <tr className="border-b">
                        <th className="py-1.5 pr-2">Tenant</th>
                        <th className="py-1.5 px-2 text-right">Requested</th>
                        <th className="py-1.5 px-2">Status</th>
                        <th className="py-1.5 px-2">Reviewed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(r => (
                        <tr key={r.id} className="border-b">
                          <td className="py-1.5 pr-2">{r.business_name}</td>
                          <td className="py-1.5 px-2 text-right">{r.requested_max_users}</td>
                          <td className="py-1.5 px-2">{statusBadge(r.status)}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{r.reviewed_at ? format(new Date(r.reviewed_at), 'MMM d, HH:mm') : '—'}</td>
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
  );
}
