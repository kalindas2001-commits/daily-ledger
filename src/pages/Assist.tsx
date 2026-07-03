import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ASSIST_CATALOG, AssistCategory, AssistService,
  AssistInputField, getServiceInputs,
} from '@/lib/assistCatalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import {
  Search, Sparkles, Clock, CheckCircle2, XCircle, Loader2, FileDown, History, UserRound,
} from 'lucide-react';

type RequestRow = {
  id: string; category_id: string; category_name: string; service_id: string;
  service_name: string; status: string; priority: string; created_at: string; notes: string | null;
  admin_notes: string | null; expert_type: string | null; inputs: any;
};

export default function Assist() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');
  const [selected, setSelected] = useState<{ cat: AssistCategory; svc: AssistService } | null>(null);
  const [detail, setDetail] = useState<RequestRow | null>(null);
  const [myRequests, setMyRequests] = useState<RequestRow[]>([]);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('assist_requests')
      .select('id,category_id,category_name,service_id,service_name,status,priority,created_at,notes,admin_notes,expert_type,inputs')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setMyRequests((data as any) ?? []);
  };

  useEffect(() => { loadMine(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('assist_requests_mine')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'assist_requests', filter: `user_id=eq.${user.id}` },
        () => loadMine())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ASSIST_CATALOG
      .filter(c => activeCat === 'all' || c.id === activeCat)
      .map(c => ({
        ...c,
        services: c.services.filter(s => !q || s.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
      }))
      .filter(c => c.services.length);
  }, [search, activeCat]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/15 text-primary"><Sparkles className="w-6 h-6" /></div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">CungaCash Assist™</h2>
            <p className="text-sm text-muted-foreground mt-1">
              150 premium professional services — an expert is auto-assigned to every request.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search 150 services…" value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={activeCat} onValueChange={setActiveCat}>
            <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {ASSIST_CATALOG.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {myRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">My Requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myRequests.slice(0, 8).map(r => (
              <button key={r.id} onClick={() => setDetail(r)}
                className="w-full text-left flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card/50 hover:border-primary/50">
                <StatusIcon status={r.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.service_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.category_name} · {new Date(r.created_at).toLocaleString()}
                    {r.expert_type && <> · <UserRound className="inline w-3 h-3" /> {r.expert_type}</>}
                  </div>
                </div>
                <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'completed' ? 'default' : 'outline'}>
                  {r.status.replace('_', ' ')}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {filtered.map(cat => {
        const Icon = (Icons as any)[cat.icon] ?? Icons.Sparkles;
        return (
          <section key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-5 h-5 ${cat.color}`} />
              <h3 className="text-lg font-semibold">{cat.name}</h3>
              <Badge variant="outline" className="ml-1">{cat.services.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cat.services.map(svc => (
                <button key={svc.id} onClick={() => setSelected({ cat, svc })}
                  className="text-left group p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm leading-snug">{svc.name}</span>
                    <Icon className={`w-4 h-4 shrink-0 ${cat.color} opacity-60 group-hover:opacity-100`} />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />{svc.sla}
                    {svc.aiAssist === 'high' && <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">AI</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <RequestDialog
        selection={selected}
        onClose={() => setSelected(null)}
        onSubmitted={() => { setSelected(null); loadMine(); }}
      />
      <RequestDetail row={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
  if (status === 'rejected' || status === 'cancelled') return <XCircle className="w-5 h-5 text-destructive" />;
  if (status === 'in_progress') return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
  return <Clock className="w-5 h-5 text-muted-foreground" />;
}

/* ---------- New request dialog with dynamic per-service inputs ---------- */
function RequestDialog({
  selection, onClose, onSubmitted,
}: { selection: { cat: AssistCategory; svc: AssistService } | null; onClose: () => void; onSubmitted: () => void }) {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, any>>({});
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fields: AssistInputField[] = useMemo(
    () => selection ? getServiceInputs(selection.cat.id, selection.svc.id) : [],
    [selection?.cat.id, selection?.svc.id],
  );

  useEffect(() => {
    if (selection) { setValues({}); setNotes(''); setPriority('normal'); }
  }, [selection?.svc.id]);

  const setField = (k: string, v: any) => setValues(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!selection || !user) return;
    const missing = fields.filter(f => f.required && !String(values[f.key] ?? '').trim());
    if (missing.length) {
      toast.error(`Please fill: ${missing.map(m => m.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('assist_requests').insert({
      user_id: user.id,
      category_id: selection.cat.id,
      category_name: selection.cat.name,
      service_id: selection.svc.id,
      service_name: selection.svc.name,
      priority,
      notes: notes.trim() || null,
      contact_email: values.contact_email || null,
      inputs: values,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Request submitted. Our team will respond shortly.');
    onSubmitted();
  };

  return (
    <Dialog open={!!selection} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {selection && (
          <>
            <DialogHeader>
              <DialogTitle>{selection.svc.name}</DialogTitle>
              <DialogDescription>
                {selection.cat.name} · Expected delivery {selection.svc.sla}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fields.map(f => (
                  <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <Label>{f.label}{f.required && ' *'}</Label>
                    <FieldInput field={f} value={values[f.key] ?? ''} onChange={v => setField(f.key, v)} />
                  </div>
                ))}
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Additional details</Label>
                <Textarea rows={4} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Describe your goal, deadline, and any specifics…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({ field, value, onChange }: { field: AssistInputField; value: any; onChange: (v: any) => void }) {
  if (field.type === 'textarea') {
    return <Textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />;
  }
  if (field.type === 'select') {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder}
    />
  );
}

/* ---------- Request details (tenant view): history + deliverables ---------- */
function RequestDetail({ row, onClose }: { row: RequestRow | null; onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    if (!row) return;
    (async () => {
      const [{ data: h }, { data: f }] = await Promise.all([
        supabase.from('assist_status_history')
          .select('*').eq('request_id', row.id).order('created_at', { ascending: true }),
        supabase.from('assist_deliverables')
          .select('*').eq('request_id', row.id).order('created_at', { ascending: false }),
      ]);
      setHistory(h ?? []);
      setFiles(f ?? []);
    })();
    const ch = supabase.channel(`assist_detail_${row.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assist_status_history', filter: `request_id=eq.${row.id}` },
        async () => {
          const { data } = await supabase.from('assist_status_history')
            .select('*').eq('request_id', row.id).order('created_at', { ascending: true });
          setHistory(data ?? []);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assist_deliverables', filter: `request_id=eq.${row.id}` },
        async () => {
          const { data } = await supabase.from('assist_deliverables')
            .select('*').eq('request_id', row.id).order('created_at', { ascending: false });
          setFiles(data ?? []);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [row?.id]);

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from('assist-deliverables')
      .createSignedUrl(path, 60 * 10);
    if (error || !data) { toast.error(error?.message || 'Could not create link'); return; }
    const a = document.createElement('a');
    a.href = data.signedUrl; a.download = name; a.target = '_blank';
    a.click();
  };

  if (!row) return null;
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row.service_name}</DialogTitle>
          <DialogDescription>
            {row.category_name} · Submitted {new Date(row.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoTile label="Status" value={row.status.replace('_', ' ')} />
          <InfoTile label="Priority" value={row.priority} />
          <InfoTile label="Assigned expert" value={row.expert_type ?? 'Auto-assigning…'} />
          <InfoTile label="Preferred contact" value={row.inputs?.preferred_contact ?? '—'} />
        </div>

        {row.admin_notes && (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Latest admin note</div>
            <div className="p-3 rounded-md bg-muted/60 whitespace-pre-wrap text-sm">{row.admin_notes}</div>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <FileDown className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Deliverables ({files.length})</h4>
          </div>
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files delivered yet. You'll be notified once your expert uploads results.</p>
          ) : (
            <div className="space-y-2">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
                  <FileDown className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{f.file_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.kind} · {new Date(f.created_at).toLocaleString()}
                      {f.size_bytes ? ` · ${(f.size_bytes / 1024).toFixed(1)} KB` : ''}
                    </div>
                    {f.admin_notes && <div className="text-xs text-muted-foreground italic mt-1">{f.admin_notes}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => download(f.storage_path, f.file_name)}>
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Activity timeline</h4>
          </div>
          <div className="relative pl-4 border-l border-border space-y-3">
            {history.map(h => (
              <div key={h.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                <div className="text-sm">
                  {h.event === 'created' && <>Request created</>}
                  {h.event === 'status_change' && <>Status → <b>{h.to_status.replace('_', ' ')}</b></>}
                  {h.event === 'note_added' && <>Admin note updated</>}
                </div>
                {h.admin_notes && <div className="text-xs italic text-muted-foreground">{h.admin_notes}</div>}
              </div>
            ))}
            {history.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border bg-card/50">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5 capitalize">{value}</div>
    </div>
  );
}
