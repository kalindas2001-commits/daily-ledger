import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAlerts, useMarkAlertRead, useDeleteAlert } from '@/hooks/useAlerts';
import { useAuth } from '@/hooks/useAuth';
import { Check, Trash2, ExternalLink, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Alerts() {
  const { data: alerts = [], isLoading } = useAlerts();
  const markRead = useMarkAlertRead();
  const del = useDeleteAlert();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const focusId = params.get('id');
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const a = alerts.find(x => x.id === focusId);
      if (a && !a.read_at) markRead.mutate(focusId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, alerts.length]);

  const sevColor = (s: string) =>
    s === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/30'
    : s === 'warning' ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
    : 'bg-primary/10 text-primary border-primary/30';

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> All Alerts ({alerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-8">Loading…</p>
           : alerts.length === 0 ? <p className="text-center text-muted-foreground py-8">No alerts yet.</p> : (
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id}
                  ref={a.id === focusId ? focusRef : null}
                  className={cn(
                    'border rounded-lg p-3 transition-all',
                    !a.read_at && 'bg-primary/5',
                    a.id === focusId && 'ring-2 ring-primary'
                  )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={sevColor(a.severity)}>{a.severity}</Badge>
                        {a.category && <span className="text-xs text-muted-foreground">{a.category}</span>}
                      </div>
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), 'PPpp')}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {isSuperAdmin && (a as any).tenant_id && (
                        <Button size="sm" variant="outline" className="gap-1 h-7"
                          onClick={() => navigate(`/admin/tenants/${(a as any).tenant_id}`)}>
                          <ExternalLink className="w-3 h-3" /> Tenant
                        </Button>
                      )}
                      {!a.read_at && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => markRead.mutate(a.id)}>
                          <Check className="w-3 h-3" /> Mark read
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-destructive" onClick={() => del.mutate(a.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
