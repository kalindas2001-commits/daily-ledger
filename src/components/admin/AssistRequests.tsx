import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Sparkles, Clock, CheckCircle2, XCircle, Loader2, Trash2, RefreshCw,
  Upload, FileDown, History, UserRound,
} from 'lucide-react';

type Row = {
  id: string; user_id: string; tenant_id: string | null;
  category_id: string; category_name: string;
  service_id: string; service_name: string;
  inputs: any; notes: string | null;
  priority: string; status: string;
  admin_notes: string | null;
  expert_type: string | null;
  contact_email: string | null;
  created_at: string;
};

const STATUSES = ['pending', 'in_progress', 'completed', 'rejected', 'cancelled'] as const;
const EXPERT_OPTIONS = [
  'Tax Advisor','Chartered Accountant','Audit Specialist','Asset Manager','Financial Analyst',
  'Business Strategist','HR Consultant','Procurement Specialist','Legal Advisor','ERP & IT Consultant',
  'Banking Specialist','Sales & CRM Consultant','Operations Consultant','Training Specialist',
  'Executive Advisor (AI)','General Consultant',
];

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
       (r.expert_type ?? '').toLowerCase().includes(q) ||
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
          <p className="text-xs text-muted-foreground">Live queue with expert routing, deliverables and audit trail.</p>
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
                    {r.category_name} · {r.inputs?.contact_name ?? '—'} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                {r.expert_type && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                    <UserRound className="w-3 h-3" />{r.expert_type}
                  </span>
                )}
                <PriorityBadge p={r.priority} />
              </div>
            </button>
          ))}
        </div>
      )}

      <RequestDetailDialog
        row={selected}
        onClose={() => setSelected(null)}
        onChanged={() => { load(); }}
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
  const [expertType, setExpertType] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [fileKind, setFileKind] = useState('report');
  const [fileNote, setFileNote] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (row) {
      setStatus(row.status);
      setExpertType(row.expert_type ?? 'General Consultant');
      setAdminNotes(row.admin_notes ?? '');
      loadSub(row.id);
    }
  }, [row?.id]);

  const loadSub = async (id: string) => {
    const [{ data: h }, { data: f }] = await Promise.all([
      supabase.from('assist_status_history').select('*').eq('request_id', id).order('created_at', { ascending: true }),
      supabase.from('assist_deliverables').select('*').eq('request_id', id).order('created_at', { ascending: false }),
    ]);
    setHistory(h ?? []);
    setFiles(f ?? []);
  };

  if (!row) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('assist_requests')
      .update({ status, expert_type: expertType, admin_notes: adminNotes || null })
      .eq('id', row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Request updated — user notified');
    await loadSub(row.id);
    onChanged();
  };

  const del = async () => {
    if (!confirm('Delete this request permanently?')) return;
    const { error } = await supabase.from('assist_requests').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Deleted');
    onChanged(); onClose();
  };

  const upload = async (file: File) => {
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${row.id}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('assist-deliverables')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: authData } = await supabase.auth.getUser();
    const { error: insErr } = await supabase.from('assist_deliverables').insert({
      request_id: row.id,
      storage_path: path,
      file_name: file.name,
      content_type: file.type,
      size_bytes: file.size,
      kind: fileKind,
      admin_notes: fileNote || null,
      uploaded_by: authData.user?.id,
    });
    setUploading(false);
    if (insErr) { toast.error(insErr.message); return; }
    setFileNote('');
    if (fileInput.current) fileInput.current.value = '';
    toast.success('Deliverable uploaded');
    loadSub(row.id);
  };

  const removeFile = async (f: any) => {
    if (!confirm(`Remove ${f.file_name}?`)) return;
    await supabase.storage.from('assist-deliverables').remove([f.storage_path]);
    await supabase.from('assist_deliverables').delete().eq('id', f.id);
    loadSub(row.id);
  };

  const downloadFile = async (f: any) => {
    const { data, error } = await supabase.storage.from('assist-deliverables')
      .createSignedUrl(f.storage_path, 600);
    if (error || !data) { toast.error(error?.message || 'Failed'); return; }
    window.open(data.signedUrl, '_blank');
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.service_name}</DialogTitle>
          <DialogDescription>{row.category_name} · {new Date(row.created_at).toLocaleString()}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Contact" value={row.inputs?.contact_name} />
          <InfoRow label="Phone" value={row.inputs?.contact_phone} />
          <InfoRow label="Email" value={row.contact_email || row.inputs?.contact_email} />
          <InfoRow label="Business size" value={row.inputs?.business_size} />
          <InfoRow label="Preferred contact" value={row.inputs?.preferred_contact} />
          <InfoRow label="Priority" value={row.priority} />
        </div>

        {row.inputs && Object.keys(row.inputs).length > 0 && (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Service inputs</div>
            <div className="p-3 rounded-md bg-muted/50 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
              {JSON.stringify(row.inputs, null, 2)}
            </div>
          </div>
        )}
        {row.notes && (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">User details</div>
            <div className="p-3 rounded-md bg-muted/50 whitespace-pre-wrap text-sm">{row.notes}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 mt-4 border-t">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Status</div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Assigned expert</div>
            <Select value={expertType} onValueChange={setExpertType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPERT_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Admin notes (visible to user)</div>
          <Textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
            placeholder="Response summary or next steps…" />
        </div>

        {/* Deliverables */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <FileDown className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Deliverables ({files.length})</h4>
          </div>
          {files.length > 0 && (
            <div className="space-y-2 mb-3">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card/70">
                  <FileDown className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.file_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.kind} · {new Date(f.created_at).toLocaleString()}
                      {f.size_bytes ? ` · ${(f.size_bytes / 1024).toFixed(1)} KB` : ''}
                    </div>
                    {f.admin_notes && <div className="text-xs italic text-muted-foreground mt-0.5">{f.admin_notes}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => downloadFile(f)}>Open</Button>
                  <Button size="sm" variant="ghost" onClick={() => removeFile(f)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1">Kind</div>
              <Select value={fileKind} onValueChange={setFileKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="report">PDF Report</SelectItem>
                  <SelectItem value="consultation">Consultation notes</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase text-muted-foreground mb-1">File note (optional)</div>
              <Input value={fileNote} onChange={e => setFileNote(e.target.value)} placeholder="e.g. Final Q3 audit report" />
            </div>
          </div>
          <div className="mt-2">
            <input ref={fileInput} type="file" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <Button size="sm" variant="outline" disabled={uploading}
              onClick={() => fileInput.current?.click()}>
              <Upload className="w-4 h-4 mr-1" />
              {uploading ? 'Uploading…' : 'Upload deliverable'}
            </Button>
          </div>
        </div>

        {/* Audit trail */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Audit trail ({history.length})</h4>
          </div>
          <div className="relative pl-4 border-l border-border space-y-3">
            {history.map(h => (
              <div key={h.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                <div className="text-sm">
                  {h.event === 'created' && <>Request created</>}
                  {h.event === 'status_change' && <>Status: <b>{h.from_status ?? '—'} → {h.to_status.replace('_', ' ')}</b></>}
                  {h.event === 'note_added' && <>Admin note updated</>}
                </div>
                {h.admin_notes && <div className="text-xs italic text-muted-foreground">"{h.admin_notes}"</div>}
              </div>
            ))}
            {history.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between mt-4">
          <Button variant="destructive" size="sm" onClick={del}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & notify user'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="p-2.5 rounded-lg border bg-card/40">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium text-sm truncate">{String(value)}</div>
    </div>
  );
}
