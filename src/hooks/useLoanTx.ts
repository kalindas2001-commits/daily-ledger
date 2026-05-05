import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface LoanTx {
  id: string;
  loan_id: string;
  action: 'ADD' | 'FULL_REPAY' | 'PARTIAL';
  amount: number;
  note: string | null;
  receipt_no: string;
  occurred_at: string;
}

export function useLoanTransactions(loanId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['loan_tx', loanId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('loan_transactions').select('*').order('occurred_at', { ascending: false });
      if (loanId) q = q.eq('loan_id', loanId);
      const { data, error } = await q;
      if (error) throw error;
      return data as LoanTx[];
    },
  });
}

export function useCreateLoanTx() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { loan_id: string; action: 'ADD' | 'FULL_REPAY' | 'PARTIAL'; amount: number; note?: string }) => {
      const { data, error } = await supabase.from('loan_transactions')
        .insert({ ...input, user_id: user!.id })
        .select().single();
      if (error) throw error;
      return data as LoanTx;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan_tx'] });
      qc.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}
