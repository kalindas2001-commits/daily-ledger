import { describe, expect, it } from 'vitest';
import { canPostCapture, type CaptureFields } from './review';
const candidate = { currency: 'RWF', treatment: 'payment', status: 'needs_review' };
const fields: CaptureFields = { account_id: 'owned-account', amount_minor: 25000, direction: 'INCOME', occurred_on: '2026-10-20', occurred_time: '10:42', category: 'Salary', description: '', payment_method: 'MTN MOMO', payment_confirmed: true };
describe('Capture posting safeguards', () => {
  it('accepts a confirmed completed payment with explicit details', () => expect(canPostCapture(candidate, fields, '2026-11-01')).toBe(true));
  it.each(['balance', 'failed', 'transfer', 'withdrawal', 'loan', 'invoice', 'reversal', 'unknown_special'])('keeps %s review-only', treatment => expect(canPostCapture({ ...candidate, treatment }, fields, '2026-11-01')).toBe(false));
  it('requires explicit payment confirmation', () => expect(canPostCapture(candidate, { ...fields, payment_confirmed: false }, '2026-11-01')).toBe(false));
  it('rejects non-RWF evidence', () => expect(canPostCapture({ ...candidate, currency: 'USD' }, fields, '2026-11-01')).toBe(false));
  it('rejects future payment dates', () => expect(canPostCapture(candidate, { ...fields, occurred_on: '2026-11-02' }, '2026-11-01')).toBe(false));
  it('rejects impossible payment dates', () => expect(canPostCapture(candidate, { ...fields, occurred_on: '2026-02-30' }, '2026-11-01')).toBe(false));
  it('requires integer money', () => expect(canPostCapture(candidate, { ...fields, amount_minor: 25000.5 }, '2026-11-01')).toBe(false));
  it('does not allow posting twice', () => expect(canPostCapture({ ...candidate, status: 'posted' }, fields, '2026-11-01')).toBe(false));
  it('restricts payment methods to the supplied six', () => expect(canPostCapture(candidate, { ...fields, payment_method: 'CASH' }, '2026-11-01')).toBe(false));
});