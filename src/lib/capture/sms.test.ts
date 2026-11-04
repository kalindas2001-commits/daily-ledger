import { describe, expect, it } from 'vitest';
import { analyzeSms, compareSmsRecords, SMS_SYNC_INTERVAL_MS, smsEvidence } from './sms';
const sms = (body: string) => ({ id: '1', sender: 'MTN MoMo', receivedAt: Date.parse('2026-11-04T04:10:00Z'), body });
describe('Android financial SMS safeguards', () => {
  it('targets exactly one minute for active sync', () => expect(SMS_SYNC_INTERVAL_MS).toBe(60_000));
  it('excludes adverts promising money', () => expect(analyzeSms(sms('MTN offer: win RWF 25,000! Subscribe to receive your payment bonus.')).kind).toBe('advertisement'));
  it('keeps a real receipt with promotional wording for review', () => expect(analyzeSms(sms('You have received RWF 25000 from Charles. Ref: TX12345 on 2026-11-04 06:10. Bonus offer available.')).kind).toBe('review'));
  it('detects personal transfers and preserves the phone number', () => {
    const result = analyzeSms(sms('You sent RWF 5000 to 0781234567 on 2026-11-04 06:10. Ref: TX45678.'));
    expect(result.record).toMatchObject({ amount_minor: 5000, direction: 'EXPENSE', occurred_time: '06:10:00', field_confidence: { counterparty_phone: '0781234567', payment_channel: 'person' } });
  });
  it('recognizes MoMo Pay with a suggested merchant category', () => expect(analyzeSms(sms('You paid RWF 8500 to Kigali Supermarket. MoMo Pay merchant ID 1234. 2026-11-04 06:10. Ref: TX56789.')).record).toMatchObject({ direction: 'EXPENSE', category: 'Groceries', field_confidence: { payment_channel: 'momo_pay' } }));
  it('keeps failed messages non-postable', () => expect(analyzeSms(sms('Payment RWF 5000 failed.')).record).toMatchObject({ treatment: 'failed', direction: null }));
  it('never substitutes receipt time for a missing payment time', () => expect(analyzeSms(sms('You received RWF 5000 from Charles.')).record?.occurred_time).toBeNull());
  it('identifies differing amounts for the same institution reference', () => {
    const a = analyzeSms(sms('You paid RWF 5000 to Charles. 2026-11-04 06:10 Ref: TX12345')).record;
    const b = analyzeSms(sms('You paid RWF 6000 to Charles. 2026-11-04 06:11 Ref: TX12345')).record;
    if (!a || !b) throw new Error('Expected candidates');
    expect(compareSmsRecords(a, b)).toMatchObject({ relation: 'same_reference', differences: ['amount', 'time'] });
  });
  it('does not label two equal-amount payments as proven duplicates', () => {
    const a = analyzeSms(sms('You paid RWF 5000 to Charles. 2026-11-04 06:10 Ref: TX12345')).record;
    const b = analyzeSms(sms('You paid RWF 5000 to Jane. 2026-11-04 06:15 Ref: TX23456')).record;
    if (!a || !b) throw new Error('Expected candidates');
    expect(compareSmsRecords(a, b)).toMatchObject({ relation: 'possible_duplicate', differences: ['time', 'person'] });
  });
  it('creates stable evidence despite different local SMS IDs', () => expect(smsEvidence(sms('You paid RWF 5000.'))).toBe(smsEvidence({ ...sms('You paid RWF 5000.'), id: '99' })));
  it('leaves unrelated personal conversations on the phone', () => expect(analyzeSms(sms('See you tomorrow.')).kind).toBe('unrelated'));
});