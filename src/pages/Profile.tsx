import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2, Shield, User as UserIcon, LogOut, Calendar, Save, Lock, Building2, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useMyTenant } from '@/hooks/useTenant';

const AVATAR_KEY = 'cungacash:avatar_url';

export default function Profile() {
  const { user, isAdmin, signOut } = useAuth();
  const { info: tenant, reload: reloadTenant } = useMyTenant();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [requestQty, setRequestQty] = useState('');
  const [requestingQuota, setRequestingQuota] = useState(false);

  const username = user?.email?.split('@')[0] ?? 'user';
  const createdAt = user?.created_at ? new Date(user.created_at) : null;

  useEffect(() => {
    if (tenant) {
      setBusinessName(tenant.business_name ?? '');
      setTinNumber(tenant.tin_number ?? '');
    }
  }, [tenant]);

  useEffect(() => {
    if (!user) return;
    const cached = localStorage.getItem(`${AVATAR_KEY}:${user.id}`);
    if (cached) setAvatarUrl(cached);

    (async () => {
      const [{ data: list }, { data: prof }] = await Promise.all([
        supabase.storage.from('avatars').list(user.id, {
          limit: 1, sortBy: { column: 'created_at', order: 'desc' },
        }),
        supabase.from('profiles').select('full_name, phone').eq('user_id', user.id).maybeSingle(),
      ]);
      if (list && list.length > 0) {
        const path = `${user.id}/${list[0].name}`;
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        const url = `${pub.publicUrl}?t=${Date.now()}`;
        setAvatarUrl(url);
        localStorage.setItem(`${AVATAR_KEY}:${user.id}`, url);
      }
      if (prof) {
        setFullName(prof.full_name ?? '');
        setPhone(prof.phone ?? '');
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

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq('user_id', user.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success('Profile saved');
  };

  const saveBusiness = async () => {
    setSavingBusiness(true);
    const { error } = await supabase.rpc('update_business_profile', {
      _business_name: businessName.trim(),
      _tin_number: tinNumber.trim(),
    });
    setSavingBusiness(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Business profile saved');
    reloadTenant();
  };

  const requestQuota = async () => {
    if (!tenant) return;
    const n = parseInt(requestQty, 10);
    if (!n || n <= tenant.max_users) {
      toast.error(`Enter a number greater than ${tenant.max_users}`);
      return;
    }
    setRequestingQuota(true);
    const { error } = await supabase.from('quota_requests').insert({
      tenant_id: tenant.tenant_id,
      requested_by: user!.id,
      requested_max_users: n,
    });
    setRequestingQuota(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Request sent to super admin');
    setRequestQty('');
    reloadTenant();
  };

  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) : '—';

  const displayName = fullName.trim() || username;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <div className="relative">
              <Avatar className="w-24 h-24 ring-4 ring-primary/10">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {displayName.slice(0, 2).toUpperCase()}
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
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h2 className="text-2xl font-bold truncate">{displayName}</h2>
                {isAdmin ? (
                  <Badge className="gap-1"><Shield className="w-3 h-3" /> Admin</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><UserIcon className="w-3 h-3" /> User</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">@{username}</p>
              <p className="text-xs text-muted-foreground mt-0.5 break-all">{user?.email}</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={signOut}>
                <LogOut className="w-4 h-4" /> Sign out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="un" className="flex items-center gap-1.5">
                Username <Lock className="w-3 h-3 text-muted-foreground" />
              </Label>
              <Input id="un" value={username} readOnly disabled className="bg-muted/40" />
              <p className="text-[11px] text-muted-foreground">Set at signup — cannot be changed.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em" className="flex items-center gap-1.5">
                Email <Lock className="w-3 h-3 text-muted-foreground" />
              </Label>
              <Input id="em" value={user?.email ?? ''} readOnly disabled className="bg-muted/40" />
              <p className="text-[11px] text-muted-foreground">Contact an admin to change.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} placeholder="Your real name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Phone number</Label>
              <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+250 ..." />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} size="sm" className="gap-2">
            <Save className="w-4 h-4" /> {savingProfile ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {tenant && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Business profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bn">Business name</Label>
                <Input id="bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                  maxLength={120} placeholder="Your business name"
                  disabled={!tenant.is_owner} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tin">TIN number</Label>
                <Input id="tin" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)}
                  maxLength={30} placeholder="Optional"
                  disabled={!tenant.is_owner} />
              </div>
            </div>
            {tenant.is_owner && (
              <Button onClick={saveBusiness} disabled={savingBusiness} size="sm" className="gap-2">
                <Save className="w-4 h-4" /> {savingBusiness ? 'Saving…' : 'Save business info'}
              </Button>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-muted-foreground" />
                  <span>User quota</span>
                </div>
                <Badge variant={tenant.current_users >= tenant.max_users ? 'destructive' : 'secondary'}>
                  {tenant.current_users} / {tenant.max_users}
                </Badge>
              </div>
              {tenant.is_owner && (
                tenant.pending_request ? (
                  <p className="text-xs text-muted-foreground">A quota increase request is pending review.</p>
                ) : (
                  <div className="flex gap-2">
                    <Input type="number" min={tenant.max_users + 1}
                      placeholder={`Request more (current: ${tenant.max_users})`}
                      value={requestQty} onChange={(e) => setRequestQty(e.target.value)}
                      className="max-w-[260px]" />
                    <Button size="sm" variant="outline" onClick={requestQuota} disabled={requestingQuota}>
                      {requestingQuota ? 'Sending…' : 'Request increase'}
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" /> Account since
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-base font-semibold">{fmtDate(createdAt)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
