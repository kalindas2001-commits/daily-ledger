import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Lock, User, Mail, Phone, UserCircle2, KeyRound, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import ForgotPassword from './ForgotPassword';

export default function Auth() {
  const { signIn } = useAuth();
  const [showForgot, setShowForgot] = useState(false);

  // Sign in
  const [siUser, setSiUser] = useState('');
  const [siPass, setSiPass] = useState('');
  const [siLoading, setSiLoading] = useState(false);

  // Shared signup fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [suPass, setSuPass] = useState('');
  const [suPass2, setSuPass2] = useState('');
  const [suLoading, setSuLoading] = useState(false);

  // Invite
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCheck, setInviteCheck] = useState<{ valid: boolean; business?: string; reason?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siUser.trim()) { toast.error('Enter your username or email'); return; }
    setSiLoading(true);
    try {
      const id = siUser.trim().toLowerCase();
      const loginEmail = id.includes('@') ? id : `${id}@fintracker.local`;
      await signIn(loginEmail, siPass);
      toast.success('Welcome back!');
    } catch (err: any) { toast.error(err.message); } finally { setSiLoading(false); }
  };

  const validateInvite = async (code: string) => {
    const c = code.trim().toUpperCase();
    setInviteCode(c);
    if (c.length < 4) { setInviteCheck(null); return; }
    setChecking(true);
    const { data, error } = await supabase.rpc('peek_invite', { _code: c });
    setChecking(false);
    if (error || !data || data.length === 0) { setInviteCheck({ valid: false, reason: 'Invalid code' }); return; }
    const r = data[0] as any;
    setInviteCheck({ valid: r.valid, business: r.business_name, reason: r.reason });
  };

  const baseSignup = async (extraMeta: Record<string, string>) => {
    if (!fullName.trim()) return toast.error('Full name is required');
    if (!email.trim() || !email.includes('@')) return toast.error('Valid email is required');
    if (!phone.trim()) return toast.error('Phone number is required');
    if (suPass.length < 6) return toast.error('Password must be at least 6 characters');
    if (suPass !== suPass2) return toast.error('Passwords do not match');

    setSuLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: suPass,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName.trim(), phone: phone.trim(), ...extraMeta },
        },
      });
      if (error) throw error;
      toast.success('Account created! You are now signed in.');
    } catch (err: any) { toast.error(err.message); } finally { setSuLoading(false); }
  };

  const handleCreateBusiness = (e: React.FormEvent) => { e.preventDefault(); baseSignup({}); };
  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCheck?.valid) return toast.error('Enter a valid invite code first');
    baseSignup({ invite_code: inviteCode });
  };

  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-sm shadow-xl border-border/50">
        <CardHeader className="text-center space-y-3 pb-2">
          <img src="/icon-192.png" alt="CungaCash" className="w-16 h-16 mx-auto rounded-2xl shadow-lg" />
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">CungaCash</CardTitle>
            <CardDescription className="mt-1">Track your finances with confidence</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-3 mb-4 h-auto">
              <TabsTrigger value="signin" className="text-xs px-2 py-2">Sign In</TabsTrigger>
              <TabsTrigger value="business" className="text-xs px-2 py-2">Create Business</TabsTrigger>
              <TabsTrigger value="join" className="text-xs px-2 py-2">Join with Code</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="text" placeholder="Username or email" value={siUser}
                    onChange={(e) => setSiUser(e.target.value)} required autoFocus
                    autoComplete="username" className="pl-10 h-11" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" placeholder="Password" value={siPass}
                    onChange={(e) => setSiPass(e.target.value)} required minLength={6}
                    autoComplete="current-password" className="pl-10 h-11" />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={siLoading}>
                  {siLoading ? 'Signing in…' : 'Sign In'}
                </Button>
                <button type="button" onClick={() => setShowForgot(true)}
                  className="w-full text-xs text-primary hover:underline text-center">
                  Forgot password?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="business">
              <div className="mb-3 p-2.5 rounded-lg bg-primary/10 text-primary flex items-start gap-2 text-xs">
                <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>You will be the <strong>admin</strong> of a new business and can invite your team afterwards.</span>
              </div>
              <SignupFields {...{ fullName, setFullName, email, setEmail, phone, setPhone, suPass, setSuPass, suPass2, setSuPass2 }} />
              <Button onClick={handleCreateBusiness} className="w-full h-11 font-semibold mt-3" disabled={suLoading}>
                {suLoading ? 'Creating…' : 'Create Business Account'}
              </Button>
            </TabsContent>

            <TabsContent value="join">
              <div className="mb-3 p-2.5 rounded-lg bg-muted text-muted-foreground flex items-start gap-2 text-xs">
                <KeyRound className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Ask your business admin for an <strong>invite code</strong> to join their team.</span>
              </div>
              <form onSubmit={handleJoinWithCode} className="space-y-3">
                <div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="text" placeholder="Invite code (e.g. ABCD1234)" value={inviteCode}
                      onChange={(e) => validateInvite(e.target.value)} required maxLength={20}
                      className="pl-10 h-11 uppercase tracking-wider font-mono" />
                  </div>
                  {checking && <p className="text-[11px] text-muted-foreground mt-1">Checking…</p>}
                  {inviteCheck && !checking && (
                    <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${inviteCheck.valid ? 'text-primary' : 'text-destructive'}`}>
                      {inviteCheck.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{inviteCheck.valid ? `Joining ${inviteCheck.business}` : inviteCheck.reason}</span>
                    </div>
                  )}
                </div>
                <SignupFields {...{ fullName, setFullName, email, setEmail, phone, setPhone, suPass, setSuPass, suPass2, setSuPass2 }} />
                <Button type="submit" className="w-full h-11 font-semibold" disabled={suLoading || !inviteCheck?.valid}>
                  {suLoading ? 'Joining…' : 'Join Team'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground">
        Developed by{' '}
        <a href="https://rossets.rw" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">rossets.rw</a>
        {' · '}
        <a href="mailto:info@rossets.rw" className="text-primary hover:underline">info@rossets.rw</a>
      </p>
    </div>
  );
}

function SignupFields(props: any) {
  const { fullName, setFullName, email, setEmail, phone, setPhone, suPass, setSuPass, suPass2, setSuPass2 } = props;
  return (
    <div className="space-y-3">
      <div className="relative">
        <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} className="pl-10 h-11" />
      </div>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="pl-10 h-11" />
      </div>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={30} autoComplete="tel" className="pl-10 h-11" />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="password" placeholder="Password (min 6)" value={suPass} onChange={(e) => setSuPass(e.target.value)} required minLength={6} autoComplete="new-password" className="pl-10 h-11" />
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input type="password" placeholder="Confirm password" value={suPass2} onChange={(e) => setSuPass2(e.target.value)} required minLength={6} autoComplete="new-password" className="pl-10 h-11" />
      </div>
    </div>
  );
}
