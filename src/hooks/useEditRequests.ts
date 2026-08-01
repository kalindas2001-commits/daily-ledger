import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';


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
      let q = supabase.from('transaction_edit_requests').select('*').order('created_at', { ascending: false });
      if (transactionId) q = q.eq('transaction_id', transactionId);
      const { data, error } = await q;
      if (error) throw error;
      return data as EditRequest[];
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
