import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useMyTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, Ban, RefreshCw, Users, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Invite {
  id: string; code: string; max_uses: number; uses: number;
  expires_at: string | null; revoked: boolean; note: string | null;
  created_at: string; status: string;
}
interface Member {
  id: string; email: string; full_name: string; is_admin: boolean;
  is_disabled: boolean; created_at: string;
}

export default function TeamMembers() {
  const { info, reload } = useMyTenant();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user form
  const [openCreate, setOpenCreate] = useState(false);
  const [cuName, setCuName] = useState('');
  const [cuEmail, setCuEmail] = useState('');
  const [cuPhone, setCuPhone] = useState('');
  const [cuPass, setCuPass] = useState('');
  const [cuRole, setCuRole] = useState<'user' | 'admin'>('user');
  const [cuLoading, setCuLoading] = useState(false);

  // Invite form
  const [openInvite, setOpenInvite] = useState(false);
  const [invUses, setInvUses] = useState(1);
  const [invHours, setInvHours] = useState(168);
  const [invNote, setInvNote] = useState('');
  const [invLoading, setInvLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [u, i] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.rpc('admin_list_invites'),
    ]);
    if (!u.error) setMembers((u.data ?? []) as Member[]);
    if (!i.error) setInvites((i.data ?? []) as Invite[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const seatsUsed = info?.current_users ?? 0;
  const seatsMax = info?.max_users ?? 0;
  const seatsLeft = Math.max(0, seatsMax - Number(seatsUsed));
  const atLimit = seatsLeft === 0;

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (atLimit) return toast.error('No seats left in your quota');
    setCuLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { full_name: cuName, email: cuEmail, phone: cuPhone, password: cuPass, role: cuRole },
    });
    setCuLoading(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message ?? 'Failed'); return; }
    toast.success(`User ${cuEmail} created`);
    setCuName(''); setCuEmail(''); setCuPhone(''); setCuPass(''); setCuRole('user');
    setOpenCreate(false);
    load(); reload();
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvLoading(true);
    const { data, error } = await supabase.rpc('admin_create_invite', {
      _max_uses: invUses, _expires_hours: invHours, _note: invNote || null,
    });
    setInvLoading(false);
    if (error) { toast.error(error.message); return; }
    const code = (data as any)?.[0]?.code;
    if (code) {
      navigator.clipboard.writeText(code).catch(() => {});
      toast.success(`Invite code ${code} created & copied`);
    }
    setInvUses(1); setInvHours(168); setInvNote('');
    setOpenInvite(false); load();
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.rpc('admin_revoke_invite', { _id: id });
    if (error) return toast.error(error.message);
    toast.success('Invite revoked'); load();
  };

  const toggleDisable = async (m: Member) => {
    const { error } = await supabase.rpc('admin_set_user_disabled', { _target_user: m.id, _disabled: !m.is_disabled });
    if (error) return toast.error(error.message);
    toast.success(m.is_disabled ? 'User enabled' : 'User disabled');
    load();
  };

  return (
    <div className="space-y-4">
      {/* Quota header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Team Seats
              </CardTitle>
              <CardDescription>{seatsUsed} of {seatsMax} used · {seatsLeft} available</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={openInvite} onOpenChange={setOpenInvite}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={atLimit}>
                    <KeyRound className="w-4 h-4 mr-1.5" /> Generate Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Generate invite code</DialogTitle></DialogHeader>
                  <form onSubmit={createInvite} className="space-y-3">
                    <div>
                      <Label>Max uses (1–100)</Label>
                      <Input type="number" min={1} max={100} value={invUses} onChange={e => setInvUses(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Expires in hours (0 = never)</Label>
                      <Input type="number" min={0} value={invHours} onChange={e => setInvHours(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Note (optional)</Label>
                      <Input value={invNote} onChange={e => setInvNote(e.target.value)} placeholder="e.g. Marketing team" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={invLoading}>{invLoading ? 'Creating…' : 'Create code'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={atLimit}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Create User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create team member</DialogTitle></DialogHeader>
                  <form onSubmit={createUser} className="space-y-3">
                    <div><Label>Full name</Label><Input value={cuName} onChange={e => setCuName(e.target.value)} required /></div>
                    <div><Label>Email</Label><Input type="email" value={cuEmail} onChange={e => setCuEmail(e.target.value)} required /></div>
                    <div><Label>Phone</Label><Input value={cuPhone} onChange={e => setCuPhone(e.target.value)} /></div>
                    <div><Label>Temporary password</Label><Input type="text" minLength={6} value={cuPass} onChange={e => setCuPass(e.target.value)} required /></div>
                    <div>
                      <Label>Role</Label>
                      <Select value={cuRole} onValueChange={(v: any) => setCuRole(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin (co-owner)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={cuLoading}>{cuLoading ? 'Creating…' : 'Create user'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {atLimit && (
            <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 text-destructive flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <span>Your business is at its user limit. Request a quota increase from the Super Admin.</span>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Invite codes */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invite Codes</CardTitle>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
           invites.length === 0 ? <p className="text-muted-foreground text-sm">No invites yet.</p> : (
            <div className="space-y-2">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-semibold text-sm tracking-wider">{inv.code}</code>
                      <Badge variant={inv.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{inv.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {inv.uses}/{inv.max_uses} used
                      {inv.expires_at && ` · expires ${format(new Date(inv.expires_at), 'MMM d, h:mm a')}`}
                      {inv.note && ` · ${inv.note}`}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(inv.code); toast.success('Copied'); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {inv.status === 'active' && (
                      <Button size="icon" variant="ghost" onClick={() => revokeInvite(inv.id)}>
                        <Ban className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
           members.length === 0 ? <p className="text-muted-foreground text-sm">No members.</p> : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{m.full_name || m.email}</span>
                      {m.is_admin && <Badge className="text-[10px]">Admin</Badge>}
                      {m.is_disabled && <Badge variant="destructive" className="text-[10px]">Disabled</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toggleDisable(m)}>
                    {m.is_disabled ? 'Enable' : 'Disable'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
