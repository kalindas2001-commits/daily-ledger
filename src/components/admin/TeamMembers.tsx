import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { UserPlus, KeyRound, Copy, Ban, RefreshCw, Users, AlertCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Download, ShieldOff, LockKeyhole, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Invite {
  id: string; code: string; max_uses: number; uses: number;
  expires_at: string | null; revoked: boolean; note: string | null;
  created_at: string; status: string;
}
interface Member {
  id: string; email: string; full_name: string; is_admin: boolean;
  is_disabled: boolean; created_at: string;
  tx_count?: number; total_income?: number; total_expense?: number;
  phone?: string; last_sign_in_at?: string | null;
}

type PendingAction = { kind: 'disable' | 'role'; member: Member } | null;

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

  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<Member | null>(null);
  const [rsEmail, setRsEmail] = useState('');
  const [rsPass, setRsPass] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [openSeats, setOpenSeats] = useState(false);
  const [seatTarget, setSeatTarget] = useState(10);
  const [seatReason, setSeatReason] = useState('');


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

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    const m = pending.member;
    const { error } = pending.kind === 'disable'
      ? await supabase.rpc('admin_set_user_disabled', { _target_user: m.id, _disabled: !m.is_disabled })
      : await (supabase.rpc as any)('tenant_set_member_role', { _target: m.id, _make_admin: !m.is_admin });
    setBusy(false);
    setPending(null);
    if (error) return toast.error(error.message);
    toast.success(pending.kind === 'disable'
      ? (m.is_disabled ? 'Member enabled' : 'Member disabled')
      : (m.is_admin ? 'Changed to regular user' : 'Promoted to admin'));
    load();
  };

  const submitReset = async () => {
    if (!resetFor) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-reset-credentials', {
      body: { target_user_id: resetFor.id, new_email: rsEmail || undefined, new_password: rsPass || undefined },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? 'Reset failed');
    toast.success('New login details saved — share them with the member securely');
    setConfirmReset(false); setResetFor(null); setRsEmail(''); setRsPass(''); load();
  };

  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const arr = new Uint32Array(10); crypto.getRandomValues(arr);
    setRsPass(Array.from(arr, (n) => chars[n % chars.length]).join(''));
  };

  const requestSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info || !user) return;
    if (seatTarget <= seatsMax) return toast.error(`Ask for more than your current ${seatsMax} seats`);
    setBusy(true);
    const { error } = await supabase.from('quota_requests').insert({
      tenant_id: info.tenant_id, requested_by: user.id, requested_max_users: seatTarget, reason: seatReason || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Seat request sent to the Super Admin');
    setOpenSeats(false); setSeatReason(''); reload();
  };

  const filtered = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (q && !`${m.full_name} ${m.email} ${m.phone ?? ''}`.toLowerCase().includes(q)) return false;
    if (roleFilter === 'admin' && !m.is_admin) return false;
    if (roleFilter === 'user' && m.is_admin) return false;
    if (statusFilter === 'active' && m.is_disabled) return false;
    if (statusFilter === 'disabled' && !m.is_disabled) return false;
    return true;
  });

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Full name', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Last active', 'Transactions', 'Income (RWF)', 'Expense (RWF)']];
    filtered.forEach((m) => rows.push([
      m.full_name, m.email, m.phone ?? '', m.is_admin ? 'Admin' : 'User', m.is_disabled ? 'Disabled' : 'Active',
      format(new Date(m.created_at), 'yyyy-MM-dd'),
      m.last_sign_in_at ? format(new Date(m.last_sign_in_at), 'yyyy-MM-dd h:mm a') : 'Never',
      String(m.tx_count ?? 0), String(m.total_income ?? 0), String(m.total_expense ?? 0),
    ]));
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `team-members-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const activeCount = members.filter((m) => !m.is_disabled).length;
  const adminCount = members.filter((m) => m.is_admin).length;

  return (
    <div className="space-y-4">
      {/* Quota header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Team Seats
              </CardTitle>
              <CardDescription>{seatsUsed} of {seatsMax} used · {seatsLeft} available</CardDescription>
              <div className="mt-2 h-1.5 w-48 max-w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${atLimit ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${seatsMax ? Math.min(100, (Number(seatsUsed) / seatsMax) * 100) : 0}%` }} />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!atLimit && (
                <Button variant="ghost" size="sm" disabled={info?.pending_request} onClick={() => { setSeatTarget(seatsMax + 5); setOpenSeats(true); }}>
                  <ArrowUpCircle className="w-4 h-4 mr-1.5" /> {info?.pending_request ? 'Seat request pending' : 'More seats'}
                </Button>
              )}
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
              <span className="flex-1">Your business is at its user limit. Request more seats from the Super Admin.</span>
              <Button size="sm" variant="outline" className="h-7" disabled={info?.pending_request} onClick={() => { setSeatTarget(seatsMax + 5); setOpenSeats(true); }}>
                {info?.pending_request ? 'Request pending' : 'Request seats'}
              </Button>
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
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base">Team Members</CardTitle>
              <CardDescription>{members.length} total · {activeCount} active · {adminCount} admin{adminCount === 1 ? '' : 's'}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-1.5" /> Export list
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px] gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Users</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
           filtered.length === 0 ? <p className="text-muted-foreground text-sm text-center py-6">No members match your filters.</p> : (
            <div className="grid gap-3 sm:gap-2.5">
              {filtered.map(m => {
                const isMe = m.id === user?.id;
                const initials = (m.full_name || m.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
                return (
                  <div key={m.id} className="p-3 sm:p-4 rounded-lg border bg-card text-card-foreground transition-colors hover:border-primary/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{initials}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link className="font-medium text-sm truncate hover:underline focus-visible:underline" to={`/team/members/${m.id}`}>{m.full_name || m.email}</Link>
                          {isMe && <Badge variant="outline" className="text-[10px] shrink-0">You</Badge>}
                          {m.is_disabled && <Badge variant="destructive" className="text-[10px] shrink-0">Disabled</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4 lg:pl-14">
                      <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                        <Link to={`/team/members/${m.id}`}><Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" /><span className="truncate sm:hidden">View</span><span className="truncate hidden sm:inline">View transactions</span></Link>
                      </Button>
                      {!isMe && <>
                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { setResetFor(m); setRsEmail(''); setRsPass(''); }}>
                          <LockKeyhole className="mr-1.5 h-3.5 w-3.5 shrink-0" /><span className="truncate sm:hidden">Reset</span><span className="truncate hidden sm:inline">Reset login details</span>
                        </Button>
                        {m.is_admin && (
                          <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setPending({ kind: 'role', member: m })}>
                            <ShieldOff className="mr-1.5 h-3.5 w-3.5 shrink-0" /><span className="truncate">Make regular user</span>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className={`w-full text-xs ${m.is_disabled ? '' : 'text-destructive hover:text-destructive'}`} onClick={() => setPending({ kind: 'disable', member: m })}>
                          <Ban className="mr-1.5 h-3.5 w-3.5 shrink-0" /><span className="truncate sm:hidden">{m.is_disabled ? 'Enable' : 'Disable'}</span><span className="truncate hidden sm:inline">{m.is_disabled ? 'Enable member' : 'Disable member'}</span>
                        </Button>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm role / status change */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === 'disable'
                ? (pending.member.is_disabled ? 'Enable this member?' : 'Disable this member?')
                : 'Make this member a regular user?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === 'disable'
                ? (pending.member.is_disabled
                     ? `${pending.member.full_name || pending.member.email} will regain access to sign in and use their existing records. Review their access before continuing.`
                     : `${pending.member.full_name || pending.member.email} will lose access to the app and will not be able to sign in. Their transactions and history will remain; this does not delete any data.`)
                : `${pending?.member.full_name || pending?.member.email} will lose admin permissions, including access to Team management, member controls, invites and team-wide records. Their own records remain available.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); runPending(); }}
              className={pending?.kind === 'disable' && !pending.member.is_disabled ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              {busy ? 'Saving…' : pending?.kind === 'disable' ? (pending.member.is_disabled ? 'Enable member' : 'Disable member') : 'Make regular user'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset credentials */}
      <Dialog open={!!resetFor && !confirmReset} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset login details</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">For {resetFor?.full_name || resetFor?.email}. Leave a field empty to keep it unchanged.</p>
          <form onSubmit={(e) => { e.preventDefault(); setConfirmReset(true); }} className="space-y-3">
            <div><Label>New email (optional)</Label><Input type="email" value={rsEmail} onChange={(e) => setRsEmail(e.target.value)} placeholder={resetFor?.email} /></div>
            <div>
              <Label>New password (optional)</Label>
              <div className="flex gap-2">
                <Input value={rsPass} minLength={6} onChange={(e) => setRsPass(e.target.value)} placeholder="At least 6 characters" />
                <Button type="button" variant="outline" onClick={genPassword}>Generate</Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || (!rsEmail && !rsPass)}>Review changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReset} onOpenChange={(o) => { if (!o && !busy) setConfirmReset(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change login details for {resetFor?.full_name || resetFor?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              {rsEmail && 'Their current email will no longer work for sign-in. '}
              {rsPass && 'Their current password will stop working. '}
              Share the new details privately with this member. They may need to sign in again on their devices; their financial records will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void submitReset(); }}>
              {busy ? 'Saving…' : 'Confirm login change'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request more seats */}
      <Dialog open={openSeats} onOpenChange={setOpenSeats}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request more seats</DialogTitle></DialogHeader>
          <form onSubmit={requestSeats} className="space-y-3">
            <div><Label>Total seats needed (currently {seatsMax})</Label><Input type="number" min={seatsMax + 1} max={1000} value={seatTarget} onChange={(e) => setSeatTarget(Number(e.target.value))} /></div>
            <div><Label>Reason (optional)</Label><Input value={seatReason} onChange={(e) => setSeatReason(e.target.value)} placeholder="e.g. New branch staff" /></div>
            <DialogFooter><Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
