import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getNotificationPrefs, showWebAlert, loadRemotePrefs } from '@/hooks/useNotificationPrefs';
import { fetchAllRows } from '@/lib/fetchAll';

/** Single source of truth for admin-note / review timestamps (badge + toast + web alert). */
export const NOTE_STAMP_FORMAT = 'MMM d, yyyy · h:mm a';
export const formatNoteStamp = (value?: string | null) =>
  format(new Date(value ?? Date.now()), NOTE_STAMP_FORMAT);


export interface EditRequest {
  id: string;
  transaction_id: string;
  user_id: string;
  requested_changes: Record<string, any>;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** User: pending edit requests for one or all of their transactions */
export function useMyEditRequests(transactionId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['edit_requests', 'mine', transactionId ?? 'all'],
    queryFn: async () => {
      const rows = await fetchAllRows<EditRequest>(() => {
        let q = supabase.from('transaction_edit_requests').select('*').order('created_at', { ascending: false });
        if (transactionId) q = q.eq('transaction_id', transactionId);
        return q;
      });
      return rows;
    },
    enabled: !!user,
  });
}

/** User: submit a new edit request */
export function useCreateEditRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: { transaction_id: string; requested_changes: Record<string, any>; reason?: string }) => {
      const { error } = await supabase.from('transaction_edit_requests').insert({
        transaction_id: args.transaction_id,
        user_id: user!.id,
        requested_changes: args.requested_changes,
        reason: args.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['edit_requests'] }),
  });
}

/** Admin: list all tenant edit requests via RPC */
export function useTenantEditRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['edit_requests', 'tenant'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_edit_requests');
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
    refetchInterval: 20_000,
  });
}

/** Admin: approve / reject */
export function useReviewEditRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; approve: boolean; admin_notes?: string }) => {
      const { error } = await supabase.rpc('apply_transaction_edit_request', {
        _request_id: args.id,
        _approve: args.approve,
        _admin_notes: args.admin_notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['edit_requests'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['admin_tenant_transactions'] });
    },
  });
}

/** User: live in-app alerts when my edit request is approved / rejected / gets notes */
export function useMyEditRequestAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    // Make sure the account-level (cross-device) preferences are loaded before alerts fire.
    loadRemotePrefs();
    const channel = supabase
      .channel(`edit_requests_mine_${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transaction_edit_requests', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const r: any = payload.new;
          const prev: any = payload.old ?? {};
          const prefs = getNotificationPrefs();
          const noteAdded = !!r.admin_notes && r.admin_notes !== prev.admin_notes;
          const stamp = formatNoteStamp(r.reviewed_at ?? r.updated_at);
          const note = r.admin_notes ? `Admin note: ${r.admin_notes}` : undefined;
          const detail = [stamp, note].filter(Boolean).join(' — ');

          const web = (title: string, body: string, enabled: boolean) => {
            if (!enabled) return;
            const state = showWebAlert(title, body);
            if (state === 'denied') {
              toast.error('Web alerts are blocked in your browser — enable notifications in site settings.', { duration: 8000 });
            } else if (state === 'default') {
              toast.message('Web alerts are not enabled yet', { description: 'Turn them on from Profile → Notification preferences.' });
            }
          };

          if (r.status === 'approved' && r.status !== prev.status) {
            if (prefs.approved.toast) toast.success('Edit request approved — changes applied', { description: detail });
            web('Edit request approved', detail, prefs.approved.web);
          } else if (r.status === 'rejected' && r.status !== prev.status) {
            if (prefs.rejected.toast) toast.error('Edit request declined', { description: detail });
            web('Edit request declined', detail, prefs.rejected.web);
          } else if (noteAdded) {
            if (prefs.notes.toast) toast('Admin added a note to your edit request', { description: `${stamp} — ${r.admin_notes}` });
            web('New admin note on your edit request', `${stamp} — ${r.admin_notes}`, prefs.notes.web);
          }
          qc.invalidateQueries({ queryKey: ['edit_requests'] });
          qc.invalidateQueries({ queryKey: ['transactions'] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);
}



/** Realtime: pending count badge for admins */
export function useEditRequestsRealtime(onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('edit_requests_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_edit_requests' }, () => onChange())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Admin: list tenant transactions (optionally filter by user) */
export function useTenantTransactions(userId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin_tenant_transactions', userId ?? 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_tenant_transactions', {
        _user_id: userId ?? null,
        _start_date: null,
        _end_date: null,
      });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });
}
