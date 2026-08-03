import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TransactionInsert {
  transaction_date: string;
  transaction_time?: string; // HH:MM:SS
  category: string;
  description?: string;
  quantity: number;
  unit_price: number;
  payment_method: string;
  type: 'INCOME' | 'EXPENSE';
  // Extended Personal Financial Record fields (all optional)
  status?: string;
  currency?: string;
  transaction_fee?: number;
  discount?: number;
  tax_amount?: number;
  final_amount?: number;
  account_id?: string;
  subcategory?: string;
  merchant_name?: string;
  merchant_phone?: string;
  merchant_location?: string;
  country?: string;
  city?: string;
  district?: string;
  place_type?: string;
  purpose?: string;
  income_source?: string;
  mood?: string;
  life_event?: string;
  tags?: string[];
  notes?: string;
}

export function useTransactions(dateRange?: { from: string; to: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transactions', dateRange],
    queryFn: async () => {
      // Paged fetch — no 1,000-row ceiling, the full history is returned.
      const rows = await fetchAllRows<any>(() => {
        let q = supabase
          .from('transactions')
          .select('*')
          .order('transaction_date', { ascending: false })
          .order('transaction_time', { ascending: false })
          .order('created_at', { ascending: false });

        if (dateRange) {
          q = q.gte('transaction_date', dateRange.from).lte('transaction_date', dateRange.to);
        }
        return q;
      });
      return rows;
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

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TransactionInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
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

// Category mutations
export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (cat: { name: string; type: 'INCOME' | 'EXPENSE' }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...cat, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, type }: { id: string; name: string; type: 'INCOME' | 'EXPENSE' }) => {
      const { data, error } = await supabase
        .from('categories')
        .update({ name, type })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// Recurring transactions
export function useRecurringTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recurring_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .order('next_run_date');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rec: {
      category: string;
      description?: string;
      quantity: number;
      unit_price: number;
      payment_method: string;
      type: 'INCOME' | 'EXPENSE';
      frequency: string;
      next_run_date: string;
    }) => {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .insert({ ...rec, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
    },
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
    },
  });
}

export function useToggleRecurring() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_transactions'] });
    },
  });
}

// Budgets
export function useBudgets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('category');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (budget: { category: string; monthly_limit: number; alert_threshold?: number }) => {
      const { data, error } = await supabase
        .from('budgets')
        .insert({ ...budget, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, monthly_limit, alert_threshold }: { id: string; monthly_limit: number; alert_threshold?: number }) => {
      const { error } = await supabase
        .from('budgets')
        .update({ monthly_limit, alert_threshold })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}
