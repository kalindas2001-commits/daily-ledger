import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Lock, KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phone.trim()) return toast.error('Email and phone are required');
    setLoading(true);
    try {
      const { error } = await supabase.rpc('request_password_reset', {
        _email: email.trim(), _phone: phone.trim(),
      });
      if (error) throw error;
      toast.success('Request sent. Contact the administrator to receive your code.');
      setStep('reset');
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return toast.error('Enter the code from your administrator');
    if (pw.length < 6) return toast.error('Password must be at least 6 characters');
    if (pw !== pw2) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-password-reset', {
        body: { email: email.trim(), code: code.trim(), new_password: pw },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Password updated! You can sign in now.');
      onBack();
    } catch (err: any) {
      toast.error(err.message ?? 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-sm shadow-xl border-border/50">
        <CardHeader className="text-center space-y-3 pb-2">
          <img src="/icon-192.png" alt="CungaCash" className="w-14 h-14 mx-auto rounded-2xl shadow-lg" />
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">
              {step === 'request' ? 'Forgot Password' : 'Enter Reset Code'}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {step === 'request'
                ? 'Submit a reset request — admin will give you a code.'
                : 'Type the 6-character code your admin shared with you.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'request' ? (
            <form onSubmit={submitRequest} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="Email address" value={email}
                  onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-11" />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="tel" placeholder="Phone number on file" value={phone}
                  onChange={(e) => setPhone(e.target.value)} required className="pl-10 h-11" />
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Request'}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                Already have a code? <button type="button" className="text-primary underline" onClick={() => setStep('reset')}>Enter code</button>
              </p>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} required className="pl-10 h-11" />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="text" placeholder="6-character code" value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={6}
                  className="pl-10 h-11 tracking-widest font-mono" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="New password (min 6)" value={pw}
                  onChange={(e) => setPw(e.target.value)} required minLength={6} className="pl-10 h-11" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" placeholder="Confirm new password" value={pw2}
                  onChange={(e) => setPw2(e.target.value)} required minLength={6} className="pl-10 h-11" />
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                {loading ? 'Updating…' : 'Reset Password'}
              </Button>
            </form>
          )}
          <button type="button" onClick={onBack}
            className="mt-4 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3 h-3" /> Back to sign in
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
