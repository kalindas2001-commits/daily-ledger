import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string | null;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export function useAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['alerts'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('alerts').select('*')
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data as Alert[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`alerts-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const a = payload.new as Alert;
          if (a.severity === 'critical') toast.error(a.title, { description: a.message });
          else if (a.severity === 'warning') toast.warning(a.title, { description: a.message });
          else toast(a.title, { description: a.message });
          qc.invalidateQueries({ queryKey: ['alerts'] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return query;
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alerts').update({ read_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alerts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
