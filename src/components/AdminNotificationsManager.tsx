import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, Trash2, Megaphone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Row {
  id: string; title: string; body: string;
  kind: 'banner' | 'popup'; created_at: string;
}

export default function AdminNotificationsManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'banner' | 'popup'>('banner');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('notifications')
      .select('*').order('created_at', { ascending: false });
    if (error) { toast.error(error.message); return; }
    setItems((data ?? []) as Row[]);
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) { toast.error('Title and message are required'); return; }
    setBusy(true);
    const { error } = await supabase.from('notifications').insert({
      title: title.trim(), body: body.trim(), kind, created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Notification sent to all users');
    setTitle(''); setBody(''); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Notification deleted everywhere');
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Broadcast notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input placeholder="Title (e.g., New feature live!)" value={title}
            onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <Textarea placeholder="Message body" value={body}
            onChange={(e) => setBody(e.target.value)} rows={3} maxLength={500} />
          <div className="flex gap-2">
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="banner">
                  <div className="flex items-center gap-2"><Megaphone className="w-3.5 h-3.5" /> Sliding banner</div>
                </SelectItem>
                <SelectItem value="popup">
                  <div className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Pop-up dialog</div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={send} disabled={busy} className="ml-auto">
              <Send className="w-4 h-4 mr-1" /> {busy ? 'Sending…' : 'Send to all users'}
            </Button>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active broadcasts ({items.length})</p>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          )}
          {items.map((n) => (
            <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border">
              <Badge variant={n.kind === 'popup' ? 'secondary' : 'default'} className="text-[10px] shrink-0">
                {n.kind}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{n.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(n.id)}
                className="text-destructive hover:text-destructive shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
