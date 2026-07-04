import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AccountKind = 'CASH' | 'BANK' | 'MOBILE_MONEY' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'SAVINGS' | 'INVESTMENT' | 'CRYPTO' | 'DIGITAL';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  account_number: string | null;
  currency: string;
  current_balance: number;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
}

export function useAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_archived', false)
        .order('created_at');
      if (error) throw error;
      return data as Account[];
    },
    enabled: !!user,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (a: { name: string; kind: AccountKind; account_number?: string; current_balance?: number; color?: string; icon?: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({ ...a, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { error } = await supabase.from('accounts').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
}
