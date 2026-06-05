import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useAlerts, useMarkAlertRead, useDeleteAlert } from '@/hooks/useAlerts';
import PushSubscribeButton from '@/components/PushSubscribeButton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function AlertsBell() {
  const navigate = useNavigate();
  const { data: alerts = [] } = useAlerts();
  const markRead = useMarkAlertRead();
  const del = useDeleteAlert();
  const [open, setOpen] = useState(false);
  const unread = alerts.filter(a => !a.read_at).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-full hover:bg-muted transition-colors" aria-label="Alerts">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b flex justify-between items-center">
          <h3 className="font-semibold text-sm">AI Alerts</h3>
          <button onClick={() => { setOpen(false); navigate('/alerts'); }}
            className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No alerts yet</p>
          ) : alerts.slice(0, 15).map(a => (
            <div key={a.id} className={cn('p-3 border-b hover:bg-muted/40 group cursor-pointer', !a.read_at && 'bg-primary/5')}
              onClick={() => { setOpen(false); navigate(`/alerts?id=${a.id}`); }}>
              <div className="flex items-start gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                  a.severity === 'critical' ? 'bg-destructive' : a.severity === 'warning' ? 'bg-amber-500' : 'bg-primary')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), 'MMM d, HH:mm')}</p>
                </div>
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  {!a.read_at && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => markRead.mutate(a.id)}><Check className="w-3 h-3" /></Button>}
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => del.mutate(a.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t"><PushSubscribeButton /></div>
      </PopoverContent>
    </Popover>
  );
}
