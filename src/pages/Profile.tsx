import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Shield, User as UserIcon, LogOut, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

const AVATAR_KEY = 'cungacash:avatar_url';

export default function Profile() {
  const { user, session, isAdmin, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const username = user?.email?.split('@')[0] ?? 'user';
  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const expiresAt = session?.expires_at ? new Date(session.expires_at * 1000) : null;

  useEffect(() => {
    if (!user) return;
    // Try cached then fresh list
    const cached = localStorage.getItem(`${AVATAR_KEY}:${user.id}`);
    if (cached) setAvatarUrl(cached);

    (async () => {
      const { data } = await supabase.storage.from('avatars').list(user.id, {
        limit: 1, sortBy: { column: 'created_at', order: 'desc' },
      });
      if (data && data.length > 0) {
        const path = `${user.id}/${data[0].name}`;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        const url = `${pub.publicUrl}?t=${Date.now()}`;
        setAvatarUrl(url);
        localStorage.setItem(`${AVATAR_KEY}:${user.id}`, url);
      }
    })();
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600', upsert: true,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      localStorage.setItem(`${AVATAR_KEY}:${user.id}`, url);
      toast.success('Profile picture updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) : '—';

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div className="relative">
              <Avatar className="w-24 h-24 ring-4 ring-primary/10">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-2 shadow-md hover:scale-105 transition-transform disabled:opacity-60"
                aria-label="Change profile picture"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-2xl font-bold">{username}</h2>
                {isAdmin ? (
                  <Badge className="gap-1"><Shield className="w-3 h-3" /> Admin</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><UserIcon className="w-3 h-3" /> User</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 break-all">{user?.email}</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={signOut}>
                <LogOut className="w-4 h-4" /> Sign out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" /> Account since
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold">{fmtDate(createdAt)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              When your credentials were issued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" /> Last sign-in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-semibold">{fmtDate(lastSignIn)}</div>
            <p className="text-xs text-muted-foreground mt-1">Most recent successful login</p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              Session status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="text-emerald-600 border-emerald-600/40">Active</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Token type</span>
              <span className="font-medium">{session?.token_type ?? 'bearer'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium">{fmtDate(expiresAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Auto-refresh</span>
              <span className="font-medium text-emerald-600">Enabled</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
