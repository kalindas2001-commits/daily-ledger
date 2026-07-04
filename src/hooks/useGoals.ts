import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Goal {
  id: string;
  name: string;
  category: string | null;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  icon: string | null;
  color: string | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  notes: string | null;
}

export function useGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('financial_goals').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!user,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (g: { name: string; category?: string; target_amount: number; target_date?: string; notes?: string; icon?: string; color?: string }) => {
      const { data, error } = await supabase
        .from('financial_goals')
        .insert({ ...g, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('financial_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });
}

export function useContributeToGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ goal_id, amount, note, transaction_id }: { goal_id: string; amount: number; note?: string; transaction_id?: string }) => {
      const { error } = await supabase.from('goal_contributions').insert({
        goal_id, amount, note, transaction_id, user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['goal_contributions'] });
    },
  });
}
