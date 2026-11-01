import type { Tables } from '@/integrations/supabase/types';
export type CaptureCandidate = Tables<'capture_candidates'>;
export type CaptureFields = {
  account_id: string; amount_minor: number; direction: string; occurred_on: string;
  occurred_time: string; category: string; description: string; payment_method: string; payment_confirmed: boolean;
};
export function canPostCapture(candidate: Pick<CaptureCandidate, 'currency' | 'treatment' | 'status'>, fields: CaptureFields, today: string): boolean {
  return ['needs_review', 'deferred'].includes(candidate.status)
    && candidate.currency === 'RWF' && ['payment', 'fee', 'unknown'].includes(candidate.treatment)
    && !!fields.account_id && Number.isSafeInteger(fields.amount_minor) && fields.amount_minor > 0 && fields.amount_minor <= 1_000_000_000_000
    && ['INCOME', 'EXPENSE'].includes(fields.direction)
    && /^\d{4}-\d{2}-\d{2}$/.test(fields.occurred_on)
    && Number.isFinite(Date.parse(fields.occurred_on))
    && new Date(`${fields.occurred_on}T12:00:00Z`).toISOString().slice(0, 10) === fields.occurred_on
    && fields.occurred_on >= '2000-01-01' && fields.occurred_on <= today
    && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(fields.occurred_time)
    && !!fields.category.trim() && fields.payment_confirmed
    && ['MTN MOMO', 'AIRTEL MONEY', 'VISA', 'MASTERCARD', 'PAYPAL', 'BANK CHEQUE'].includes(fields.payment_method);
}