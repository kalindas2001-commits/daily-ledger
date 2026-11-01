import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';
import type { CaptureCandidate, CaptureFields } from '@/lib/capture/review';
import type { CaptureRecord } from '@/lib/capture/parser';
import { PARSER_VERSION } from '@/lib/capture/parser';

export type CaptureKind = 'sms' | 'document' | 'statement';
export function useMoneyCapture(status: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sources = useQuery({
    queryKey: ['capture', 'sources', user?.id], enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('Sign in to continue');
      const { data, error } = await supabase.from('capture_sources').select('*').eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
  });
  const inbox = useInfiniteQuery({
    queryKey: ['capture', 'inbox', user?.id, status], enabled: !!user, initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!user) throw new Error('Sign in to continue');
      let query = supabase.from('capture_candidates').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).order('id').range(pageParam, pageParam + 49);
      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) => last.length === 50 ? pages.length * 50 : undefined,
    placeholderData: undefined,
  });
  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['capture'] });
  };
  const consent = useMutation({
    mutationFn: async ({ kind, enabled }: { kind: CaptureKind; enabled: boolean }) => {
      const { error } = await supabase.rpc('capture_set_consent', { _kind: kind, _enabled: enabled });
      if (error) throw error;
    }, onSuccess: invalidate,
  });
  const register = useMutation({
    mutationFn: async ({ kind, name, text, records, accountId }: { kind: CaptureKind; name: string; text: string; records: CaptureRecord[]; accountId: string }) => {
      const { data, error } = await supabase.rpc('capture_register_import', {
        _kind: kind, _file_name: name, _raw_text: text, _account_id: accountId,
        _records: JSON.parse(JSON.stringify(records)) as Json, _parser_version: PARSER_VERSION,
      });
      if (error) throw error;
      return data;
    }, onSuccess: invalidate,
  });
  const resolve = useMutation({
    mutationFn: async ({ candidate, action, fields, matchId, separate }: { candidate: CaptureCandidate; action: 'post' | 'match' | 'reject' | 'defer'; fields: Partial<CaptureFields> & { reason?: string }; matchId?: string; separate?: boolean }) => {
      const { data, error } = await supabase.rpc('capture_resolve', {
        _id: candidate.id, _version: candidate.version, _action: action,
        _fields: fields as Json, _match_id: matchId, _separate: separate ?? false,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all(['capture', 'transactions', 'accounts', 'daily_summaries'].map(key => qc.invalidateQueries({ queryKey: [key] })));
    },
  });
  return { sources, inbox, consent, register, resolve };
}

export function useCaptureEvidence(candidate: CaptureCandidate) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['capture', 'evidence', user?.id, candidate.id], enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error('Sign in to continue');
      const [evidence, job, audit, links] = await Promise.all([
        supabase.from('capture_evidence').select('raw_text,created_at').eq('id', candidate.evidence_id).eq('user_id', user.id).single(),
        supabase.from('capture_import_jobs').select('file_name,parser_version,created_at').eq('id', candidate.job_id).eq('user_id', user.id).single(),
        supabase.from('capture_audit_events').select('*').eq('user_id', user.id).or(`candidate_id.eq.${candidate.id},job_id.eq.${candidate.job_id}`).order('created_at'),
        supabase.from('capture_posting_links').select('transaction_id').eq('user_id', user.id).eq('candidate_id', candidate.id).maybeSingle(),
      ]);
      for (const response of [evidence, job, audit, links]) if (response.error) throw response.error;
      return { evidence: evidence.data, job: job.data, audit: audit.data, link: links.data };
    },
  });
}

export function useCaptureMatches(fields: CaptureFields) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['capture', 'matches', user?.id, fields.account_id, fields.amount_minor, fields.direction, fields.occurred_on],
    enabled: !!user && !!fields.account_id && fields.amount_minor > 0 && ['INCOME', 'EXPENSE'].includes(fields.direction) && /^\d{4}-\d{2}-\d{2}$/.test(fields.occurred_on) && Number.isFinite(Date.parse(fields.occurred_on)),
    placeholderData: undefined,
    queryFn: async () => {
      if (!user) throw new Error('Sign in to continue');
      const day = new Date(`${fields.occurred_on}T12:00:00Z`);
      const from = new Date(day.getTime() - 86400000).toISOString().slice(0, 10);
      const to = new Date(day.getTime() + 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase.from('transactions').select('id,category,description,transaction_date,total_amount')
        .eq('user_id', user.id).eq('account_id', fields.account_id).eq('currency', 'RWF')
        .eq('type', fields.direction as 'INCOME' | 'EXPENSE').eq('total_amount', fields.amount_minor)
        .gte('transaction_date', from).lte('transaction_date', to).order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}