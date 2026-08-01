import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, User as UserIcon } from 'lucide-react';
import { useTenantEditRequests, useReviewEditRequest, useEditRequestsRealtime } from '@/hooks/useEditRequests';
import { useQueryClient } from '@tanstack/react-query';

const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-RW');

function diffRow(label: string, oldV: any, newV: any) {
  if (newV === undefined || newV === null || newV === '') return null;
  return (
    <div key={label} className="grid grid-cols-3 gap-2 text-xs py-1 border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="line-through text-muted-foreground truncate">{String(oldV ?? '—')}</span>
      <span className="font-medium text-primary truncate">{String(newV)}</span>
    </div>
  );
}

export default function EditRequestsQueue() {
  const qc = useQueryClient();
  const { data, isLoading } = useTenantEditRequests();
  const review = useReviewEditRequest();
  useEditRequestsRealtime(() => qc.invalidateQueries({ queryKey: ['edit_requests'] }));

  const [confirm, setConfirm] = useState<{ id: string; approve: boolean } | null>(null);
  const [note, setNote] = useState('');

  const pending = (data ?? []).filter(r => r.status === 'pending');
  const reviewed = (data ?? []).filter(r => r.status !== 'pending').slice(0, 20);

  const submit = async () => {
    if (!confirm) return;
    try {
      await review.mutateAsync({ id: confirm.id, approve: confirm.approve, admin_notes: note || undefined });
      toast.success(confirm.approve ? 'Edit approved & applied' : 'Edit rejected');
      setConfirm(null); setNote('');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold">Transaction Edit Requests</h3>
        {pending.length > 0 && <Badge>{pending.length} pending</Badge>}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && pending.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No pending edit requests.</CardContent></Card>
      )}

      {pending.map(r => (
        <Card key={r.id} className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{r.full_name || 'Team member'}</span>
                <Badge variant="secondary" className="text-[10px]">{format(new Date(r.created_at), 'MMM d, HH:mm')}</Badge>
              </div>
              <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> pending</Badge>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Original transaction</p>
              <p className="text-sm">
                <strong>{r.tx_snapshot?.type}</strong> · {r.tx_snapshot?.category} · <strong>{fmt(r.tx_snapshot?.total_amount)} RWF</strong> · {r.tx_snapshot?.transaction_date}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Proposed changes</p>
              <div className="rounded-lg border">
                {Object.entries(r.requested_changes ?? {}).map(([k, v]) =>
                  diffRow(k, r.tx_snapshot?.[k], v))}
                {Object.keys(r.requested_changes ?? {}).length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No fields changed.</p>
                )}
              </div>
            </div>

            {r.reason && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reason</p>
                <p className="text-sm bg-muted/40 p-2 rounded">{r.reason}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={() => setConfirm({ id: r.id, approve: true })}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve & apply
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirm({ id: r.id, approve: false })}>
                <XCircle className="w-4 h-4 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Audit trail */}
      <div className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Audit trail</h4>
          <Badge variant="secondary" className="text-[10px]">{(data ?? []).length} records</Badge>
        </div>
        {(data ?? []).length === 0 && (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No edit request history yet.</CardContent></Card>
        )}
        <div className="space-y-2">
          {(data ?? []).map(r => (
            <Card key={`audit-${r.id}`} className={r.status === 'pending' ? 'border-primary/30' : 'opacity-90'}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.full_name || 'Team member'} — {r.tx_snapshot?.category ?? '—'} · {fmt(r.tx_snapshot?.total_amount)} RWF
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Requested {format(new Date(r.created_at), 'MMM d, yyyy · h:mm:ss a')}
                      {r.reviewed_at && ` → Reviewed ${format(new Date(r.reviewed_at), 'MMM d, yyyy · h:mm:ss a')}`}
                    </p>
                  </div>
                  <Badge
                    variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'outline'}
                    className="text-[10px]"
                  >
                    {r.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                    {r.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {r.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                    {r.status}
                  </Badge>
                </div>

                <div className="rounded border">
                  {Object.entries(r.requested_changes ?? {}).map(([k, v]) => diffRow(k, r.tx_snapshot?.[k], v))}
                </div>

                {r.reason && <p className="text-xs"><span className="text-muted-foreground">Reason: </span>{r.reason}</p>}
                {r.admin_notes && (
                  <p className="text-xs bg-muted/40 p-2 rounded"><span className="text-muted-foreground">Admin note: </span>{r.admin_notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>


      <AlertDialog open={!!confirm} onOpenChange={o => { if (!o) { setConfirm(null); setNote(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.approve ? 'Approve & apply changes?' : 'Reject this edit request?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.approve
                ? 'The requested changes will be applied to the transaction and the user will be notified.'
                : 'The user will be notified that their edit request was declined.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            className="mt-2"
            placeholder="Optional note to the requester…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>{confirm?.approve ? 'Approve' : 'Reject'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
