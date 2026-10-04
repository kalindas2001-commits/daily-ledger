import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { format, isValid } from 'date-fns';
import { ArrowLeft, Mail, Phone, CalendarDays, Clock3, TrendingUp, TrendingDown, ReceiptText, LockKeyhole, ShieldOff, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import TeamTransactionsPanel from '@/components/admin/TeamTransactionsPanel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Member = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  is_admin: boolean; is_disabled: boolean; created_at: string; last_sign_in_at: string | null;
  total_income: number | null; total_expense: number | null; tx_count: number | null;
};

type PendingAction = { kind: 'disable' | 'role' } | null;

const money = (value: number | null) => `${Number(value ?? 0).toLocaleString('en-RW')} RWF`;
const date = (value: string | null, pattern: string) => {
  if (!value) return 'Never';
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, pattern) : 'Unavailable';
};

export default function TeamMemberDetail() {
  const { id } = useParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Member actions
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [rsEmail, setRsEmail] = useState('');
  const [rsPass, setRsPass] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const fetchMember = useCallback(async () => {
    if (!isAdmin || !id) return;
    setLoading(true);
    const { data, error: requestError } = await supabase.rpc('admin_list_users');
    setError(requestError?.message ?? '');
    setMember(((data ?? []) as Member[]).find((item) => item.id === id) ?? null);
    setLoading(false);
  }, [id, isAdmin]);

  useEffect(() => { void fetchMember(); }, [fetchMember]);

  if (authLoading) return <p className="py-12 text-center text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const isMe = member?.id === user?.id;
  const displayName = member?.full_name || member?.email || 'Team member';

  const runPending = async () => {
    if (!pending || !member) return;
    setBusy(true);
    const { error: actionError } = pending.kind === 'disable'
      ? await supabase.rpc('admin_set_user_disabled', { _target_user: member.id, _disabled: !member.is_disabled })
      : await (supabase.rpc as any)('tenant_set_member_role', { _target: member.id, _make_admin: !member.is_admin });
    setBusy(false);
    setPending(null);
    if (actionError) return toast.error(actionError.message);
    toast.success(pending.kind === 'disable'
      ? (member.is_disabled ? 'Member enabled' : 'Member disabled')
      : 'Changed to regular user');
    void fetchMember();
  };

  const submitReset = async () => {
    if (!member) return;
    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke('admin-reset-credentials', {
      body: { target_user_id: member.id, new_email: rsEmail || undefined, new_password: rsPass || undefined },
    });
    setBusy(false);
    if (invokeError || (data as any)?.error) return toast.error((data as any)?.error ?? invokeError?.message ?? 'Reset failed');
    toast.success('New login details saved — share them with the member securely');
    setConfirmReset(false); setResetOpen(false); setRsEmail(''); setRsPass('');
    void fetchMember();
  };

  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const arr = new Uint32Array(10); crypto.getRandomValues(arr);
    setRsPass(Array.from(arr, (n) => chars[n % chars.length]).join(''));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" asChild><Link to="/team"><ArrowLeft className="mr-2 h-4 w-4" />Team members</Link></Button>
      {loading ? <p className="py-12 text-muted-foreground">Loading member details…</p> : error ? (
        <p role="alert" className="text-destructive">Could not load this member: {error}</p>
      ) : !member ? (
        <p role="alert" className="text-muted-foreground">This member is not available in your team.</p>
      ) : (
        <>
          <header className="border-b pb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold break-words">{displayName}</h1>
              <Badge variant={member.is_disabled ? 'destructive' : 'secondary'}>{member.is_disabled ? 'Disabled' : 'Active'}</Badge>
              <Badge variant="outline">{member.is_admin ? 'Admin' : 'Regular user'}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {member.email && <span className="inline-flex items-center gap-2 break-all"><Mail className="h-4 w-4 shrink-0" />{member.email}</span>}
              {member.phone && <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{member.phone}</span>}
            </div>
          </header>

          {!isMe && (
            <section aria-label="Member actions" className="space-y-3">
              <h2 className="text-lg font-semibold">Actions</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="outline" size="sm" onClick={() => { setRsEmail(''); setRsPass(''); setResetOpen(true); }}>
                  <LockKeyhole className="mr-1.5 h-4 w-4 shrink-0" />Reset login details
                </Button>
                {member.is_admin && (
                  <Button variant="outline" size="sm" onClick={() => setPending({ kind: 'role' })}>
                    <ShieldOff className="mr-1.5 h-4 w-4 shrink-0" />Make regular user
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={member.is_disabled ? '' : 'text-destructive hover:text-destructive'}
                  onClick={() => setPending({ kind: 'disable' })}
                >
                  <Ban className="mr-1.5 h-4 w-4 shrink-0" />{member.is_disabled ? 'Enable member' : 'Disable member'}
                </Button>
              </div>
            </section>
          )}

          <section aria-label="Member activity" className="grid grid-cols-2 gap-4 border-b pb-6 lg:grid-cols-5">
            <Metric icon={TrendingUp} label="Income" value={money(member.total_income)} />
            <Metric icon={TrendingDown} label="Expense" value={money(member.total_expense)} />
            <Metric icon={ReceiptText} label="Transactions" value={String(member.tx_count ?? 0)} />
            <Metric icon={CalendarDays} label="Joined" value={date(member.created_at, 'MMM d, yyyy')} />
            <Metric icon={Clock3} label="Last active" value={date(member.last_sign_in_at, 'MMM d, h:mm a')} />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Transactions</h2>
            <TeamTransactionsPanel userId={member.id} userName={displayName} />
          </section>

          {/* Confirm role / status change */}
          <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pending?.kind === 'disable'
                    ? (member.is_disabled ? 'Enable this member?' : 'Disable this member?')
                    : 'Make this member a regular user?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pending?.kind === 'disable'
                    ? (member.is_disabled
                        ? `${displayName} will regain access to sign in and use their existing records. Review their access before continuing.`
                        : `${displayName} will lose access to the app and will not be able to sign in. Their transactions and history will remain; this does not delete any data.`)
                    : `${displayName} will lose admin permissions, including access to Team management, member controls, invites and team-wide records. Their own records remain available.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void runPending(); }}
                  className={pending?.kind === 'disable' && !member.is_disabled ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
                  {busy ? 'Saving…' : pending?.kind === 'disable' ? (member.is_disabled ? 'Enable member' : 'Disable member') : 'Make regular user'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Reset credentials */}
          <Dialog open={resetOpen && !confirmReset} onOpenChange={(o) => !o && setResetOpen(false)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Reset login details</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground -mt-2">For {displayName}. Leave a field empty to keep it unchanged.</p>
              <form onSubmit={(e) => { e.preventDefault(); setConfirmReset(true); }} className="space-y-3">
                <div><Label>New email (optional)</Label><Input type="email" value={rsEmail} onChange={(e) => setRsEmail(e.target.value)} placeholder={member.email ?? ''} /></div>
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
                <AlertDialogTitle>Change login details for {displayName}?</AlertDialogTitle>
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
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return <div className="min-w-0 space-y-1">
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{label}</span>
    <p className="font-semibold text-foreground break-words">{value}</p>
  </div>;
}
