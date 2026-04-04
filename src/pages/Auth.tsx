import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, User } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { toast.error('Please enter your username'); return; }
    setLoading(true);
    try {
      await signIn(`${username.toLowerCase().trim()}@fintracker.local`, password);
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-sm shadow-xl border-border/50">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto">
            <img src="/icon-192.png" alt="J.LucTRACKER" className="w-16 h-16 mx-auto rounded-2xl shadow-lg" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">J.LucTRACKER</CardTitle>
            <CardDescription className="mt-1">Sign in to manage your finances</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                className="pl-10 h-11"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                className="pl-10 h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground">
        Developed by{' '}
        <a href="https://rossets.rw" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          rossets.rw
        </a>
        {' · '}
        <a href="mailto:info@rossets.rw" className="text-primary hover:underline">info@rossets.rw</a>
      </p>
    </div>
  );
}
