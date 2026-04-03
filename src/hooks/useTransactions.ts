import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TransactionInsert {
  transaction_date: string;
  category: string;
  description?: string;
  quantity: number;
  unit_price: number;
  payment_method: string;
  type: 'INCOME' | 'EXPENSE';
}

export function useTransactions(dateRange?: { from: string; to: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transactions', dateRange],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateRange) {
        q = q.gte('transaction_date', dateRange.from).lte('transaction_date', dateRange.to);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useDailySummaries(from: string, to: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['daily_summaries', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .gte('summary_date', from)
        .lte('summary_date', to)
        .order('summary_date');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (tx: TransactionInsert) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert({ ...tx, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['daily_summaries'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['daily_summaries'] });
    },
  });
}
