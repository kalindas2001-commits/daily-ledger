import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ASSIST_CATALOG, AssistCategory, AssistService } from '@/lib/assistCatalog';
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
import { Search, Sparkles, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type RequestRow = {
  id: string; category_id: string; category_name: string; service_id: string;
  service_name: string; status: string; priority: string; created_at: string; notes: string | null;
  admin_notes: string | null;
};

export default function Assist() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('all');
  const [selected, setSelected] = useState<{ cat: AssistCategory; svc: AssistService } | null>(null);
  const [myRequests, setMyRequests] = useState<RequestRow[]>([]);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('assist_requests')
      .select('id,category_id,category_name,service_id,service_name,status,priority,created_at,notes,admin_notes')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setMyRequests((data as RequestRow[]) ?? []);
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
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/15 text-primary"><Sparkles className="w-6 h-6" /></div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">CungaCash Assist™</h2>
            <p className="text-sm text-muted-foreground mt-1">
              150 premium professional services — from tax advisory to AI-driven executive insights.
              Submit a request and our team will respond directly.
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

      {/* My requests */}
      {myRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">My Requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myRequests.slice(0, 6).map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card/50">
                <StatusIcon status={r.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.service_name}</div>
                  <div className="text-xs text-muted-foreground">{r.category_name} · {new Date(r.created_at).toLocaleString()}</div>
                </div>
                <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'completed' ? 'default' : 'outline'}>
                  {r.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Catalog */}
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
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
  if (status === 'rejected' || status === 'cancelled') return <XCircle className="w-5 h-5 text-destructive" />;
  if (status === 'in_progress') return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
  return <Clock className="w-5 h-5 text-muted-foreground" />;
}

function RequestDialog({
  selection, onClose, onSubmitted,
}: { selection: { cat: AssistCategory; svc: AssistService } | null; onClose: () => void; onSubmitted: () => void }) {
  const { user } = useAuth();
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [businessSize, setBusinessSize] = useState('');
  const [preferredContact, setPreferredContact] = useState('email');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selection) { setContactName(''); setContactPhone(''); setBusinessSize(''); setNotes(''); setPriority('normal'); }
  }, [selection?.svc.id]);

  const submit = async () => {
    if (!selection || !user) return;
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.error('Please provide your name and phone number.'); return;
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
      inputs: {
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        business_size: businessSize || null,
        preferred_contact: preferredContact,
      },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Request submitted. Our team will contact you shortly.');
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact name *</Label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} />
                </div>
                <div>
                  <Label>Phone / WhatsApp *</Label>
                  <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Business size</Label>
                  <Select value={businessSize} onValueChange={setBusinessSize}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="micro">Micro (1–5)</SelectItem>
                      <SelectItem value="small">Small (6–20)</SelectItem>
                      <SelectItem value="medium">Medium (21–100)</SelectItem>
                      <SelectItem value="large">Large (100+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preferred contact</Label>
                  <Select value={preferredContact} onValueChange={setPreferredContact}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
