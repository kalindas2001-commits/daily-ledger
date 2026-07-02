import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Sparkles, Clock, CheckCircle2, XCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';

type Row = {
  id: string; user_id: string; tenant_id: string | null;
  category_id: string; category_name: string;
  service_id: string; service_name: string;
  inputs: any; notes: string | null;
  priority: string; status: string;
  admin_notes: string | null;
  created_at: string;
};

const STATUSES = ['pending', 'in_progress', 'completed', 'rejected', 'cancelled'] as const;

export default function AssistRequestsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('assist_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase.channel('assist_requests_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assist_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (statusFilter === 'all' || r.status === statusFilter) &&
      (!q || r.service_name.toLowerCase().includes(q) || r.category_name.toLowerCase().includes(q) ||
       (r.inputs?.contact_name ?? '').toLowerCase().includes(q) ||
       (r.inputs?.contact_phone ?? '').toLowerCase().includes(q))
    );
  }, [rows, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    STATUSES.forEach(s => c[s] = 0);
    rows.forEach(r => c[r.status] = (c[r.status] ?? 0) + 1);
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-5 h-5" /></div>
        <div className="flex-1">
          <h3 className="font-semibold">CungaCash Assist Requests</h3>
          <p className="text-xs text-muted-foreground">Live queue of service requests from all tenants.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}>
            {s.replace('_', ' ')} <Badge variant="secondary" className="ml-2">{counts[s] ?? 0}</Badge>
          </Button>
        ))}
        <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          className="sm:w-64 ml-auto" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 mx-auto animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No requests.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <button key={r.id} onClick={() => setSelected(r)}
              className="w-full text-left p-3 rounded-lg border bg-card hover:border-primary/50 hover:shadow-sm transition-all">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={r.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.service_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.category_name} · {r.inputs?.contact_name ?? '—'} · {r.inputs?.contact_phone ?? '—'} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <PriorityBadge p={r.priority} />
              </div>
            </button>
          ))}
        </div>
      )}

      <RequestDetailDialog
        row={selected}
        onClose={() => setSelected(null)}
        onChanged={() => { load(); setSelected(null); }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; className: string; label: string }> = {
    pending:     { icon: Clock,          className: 'bg-muted text-foreground',                   label: 'Pending' },
    in_progress: { icon: Loader2,        className: 'bg-primary/15 text-primary',                 label: 'In progress' },
    completed:   { icon: CheckCircle2,   className: 'bg-emerald-500/15 text-emerald-600',         label: 'Completed' },
    rejected:    { icon: XCircle,        className: 'bg-destructive/15 text-destructive',         label: 'Rejected' },
    cancelled:   { icon: XCircle,        className: 'bg-muted text-muted-foreground',             label: 'Cancelled' },
  };
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${cfg.className}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    low: 'bg-slate-200 text-slate-700',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${map[p] ?? map.normal}`}>{p}</span>;
}

function RequestDetailDialog({
  row, onClose, onChanged,
}: { row: Row | null; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState('pending');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) { setStatus(row.status); setAdminNotes(row.admin_notes ?? ''); }
  }, [row?.id]);

  if (!row) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('assist_requests')
      .update({ status, admin_notes: adminNotes || null }).eq('id', row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Request updated');
    onChanged();
  };

  const del = async () => {
    if (!confirm('Delete this request permanently?')) return;
    const { error } = await supabase.from('assist_requests').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.service_name}</DialogTitle>
          <DialogDescription>{row.category_name} · {new Date(row.created_at).toLocaleString()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <InfoRow label="Contact" value={row.inputs?.contact_name} />
          <InfoRow label="Phone / WhatsApp" value={row.inputs?.contact_phone} />
          <InfoRow label="Business size" value={row.inputs?.business_size} />
          <InfoRow label="Preferred contact" value={row.inputs?.preferred_contact} />
          <InfoRow label="Priority" value={row.priority} />
          {row.notes && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Details</div>
              <div className="p-3 rounded-md bg-muted/50 whitespace-pre-wrap">{row.notes}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Status</div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Admin notes</div>
            <Textarea rows={4} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
              placeholder="Internal notes / response summary…" />
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between">
          <Button variant="destructive" size="sm" onClick={del}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-border/50 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );
}
