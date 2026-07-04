import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Attachment {
  id: string;
  transaction_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string | null;
  created_at: string;
}

export function useAttachments(transactionId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tx_attachments', transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_attachments')
        .select('*')
        .eq('transaction_id', transactionId!)
        .order('created_at');
      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!user && !!transactionId,
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ transaction_id, file, kind = 'receipt' }: { transaction_id: string; file: File; kind?: string }) => {
      const path = `${user!.id}/${transaction_id}/${Date.now()}_${file.name}`;
      const up = await supabase.storage.from('transaction-attachments').upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { error } = await supabase.from('transaction_attachments').insert({
        user_id: user!.id,
        transaction_id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        kind,
      });
      if (error) throw error;
    },
    onSuccess: (_, { transaction_id }) => qc.invalidateQueries({ queryKey: ['tx_attachments', transaction_id] }),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: Attachment) => {
      await supabase.storage.from('transaction-attachments').remove([att.storage_path]);
      const { error } = await supabase.from('transaction_attachments').delete().eq('id', att.id);
      if (error) throw error;
    },
    onSuccess: (_, att) => qc.invalidateQueries({ queryKey: ['tx_attachments', att.transaction_id] }),
  });
}

export async function getSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('transaction-attachments').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
