import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SavingsAccount {
  id: string;
  name: string;
  goal_amount: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface SavingsTx {
  id: string;
  account_id: string;
  action: 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  note: string | null;
  receipt_no: string;
  occurred_at: string;
}

export function useSavingsAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['savings_accounts'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('savings_accounts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as SavingsAccount[];
    },
  });
}

export function useSavingsTransactions(accountId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['savings_tx', accountId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('savings_transactions').select('*').order('occurred_at', { ascending: false });
      if (accountId) q = q.eq('account_id', accountId);
      const { data, error } = await q;
      if (error) throw error;
      return data as SavingsTx[];
    },
  });
}

export function useCreateSavingsAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; goal_amount?: number }) => {
      const { data, error } = await supabase.from('savings_accounts')
        .insert({ name: input.name, goal_amount: input.goal_amount ?? 0, user_id: user!.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings_accounts'] }),
  });
}

export function useDeleteSavingsAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('savings_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['savings_accounts'] });
      qc.invalidateQueries({ queryKey: ['savings_tx'] });
    },
  });
}

export function useCreateSavingsTx() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { account_id: string; action: 'DEPOSIT' | 'WITHDRAW'; amount: number; note?: string }) => {
      const { data, error } = await supabase.from('savings_transactions')
        .insert({ ...input, user_id: user!.id })
        .select().single();
      if (error) throw error;
      return data as SavingsTx;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['savings_tx'] });
      qc.invalidateQueries({ queryKey: ['savings_accounts'] });
    },
  });
}
