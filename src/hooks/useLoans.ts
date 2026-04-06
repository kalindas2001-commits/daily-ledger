import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LoanInsert {
  person_name: string;
  amount: number;
  type: 'GIVEN' | 'RECEIVED';
  description?: string;
  loan_date: string;
}

export function useLoans(statusFilter?: 'PENDING' | 'PAID') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['loans', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('loans')
        .select('*')
        .order('loan_date', { ascending: false });

      if (statusFilter) {
        q = q.eq('status', statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (loan: LoanInsert) => {
      const { data, error } = await supabase
        .from('loans')
        .insert({ ...loan, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}

export function useMarkLoanPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'PAID', paid_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}
