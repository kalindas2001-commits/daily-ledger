import { z } from 'zod';
import { parseMessage, type CaptureRecord } from './parser';

export const SMS_SYNC_INTERVAL_MS = 60_000;
export const smsSchema = z.object({
  id: z.string().regex(/^\d+$/), sender: z.string().max(200),
  body: z.string().min(1).max(8000), receivedAt: z.number().int().positive(),
});
export type PhoneSms = z.infer<typeof smsSchema>;
export type SmsAnalysis = { kind: 'advertisement' | 'unrelated' | 'review'; record: CaptureRecord | null };

export function analyzeSms(input: PhoneSms): SmsAnalysis {
  const sms = smsSchema.parse(input);
  const advert = /\b(promotion|promo|offer|win|jackpot|lottery|discount|subscribe|bonus|cashback|advert)\b|igabanyirizwa|gutsindira/i.test(sms.body);
  const completed = /\b(you (?:have )?(?:received|sent|paid)|successfully (?:sent|paid|received)|payment (?:of .*? )?(?:completed|successful)|account (?:has been |was )?(?:credited|debited))\b|wakiriye|wohereje|wishyuye/i.test(sms.body);
  if (advert && !completed) return { kind: 'advertisement', record: null };
  if (!/(?:RWF|FRW|USD|EUR)\s*\d|\d[\d,]*\s*(?:RWF|FRW|USD|EUR)/i.test(sms.body)
    || !/received|sent|paid|payment|credited|debited|transfer|withdraw|deposit|failed|pending|revers|refund|wakiriye|wohereje|wishyuye/i.test(sms.body)) {
    return { kind: 'unrelated', record: null };
  }
  // Sender labels are context only: they can be spoofed and never verify a payment.
  const record = parseMessage(sms.body);
  if (record.provider === 'Unknown') {
    record.provider = /airtel/i.test(sms.sender) ? 'Airtel Money' : /\bmtn\b|momo/i.test(sms.sender) ? 'MTN MoMo' : 'Unknown';
  }
  const person = sms.body.match(/\b(?:from|to)\s+([^.;\n]+?)(?=\s+(?:on|at|transaction|ref|balance|fee)\b|[.;\n]|$)/i)?.[1]?.trim().slice(0, 200) ?? '';
  const phone = person.match(/(?:\+?250\s*)?0?7[2389]\d{7}/)?.[0]?.replace(/\s/g, '') ?? '';
  const merchant = /momo\s*pay|merchant|business|commercial|institution|bank|company|ltd|shop|supermarket/i.test(`${person} ${sms.body}`);
  const channel = /momo\s*pay|merchant\s*(?:id|code)/i.test(sms.body) ? 'momo_pay' : merchant ? 'institution' : person ? 'person' : 'unknown';
  if (!record.direction && /wakiriye/i.test(sms.body)) record.direction = 'INCOME';
  if (!record.direction && /wohereje|wishyuye/i.test(sms.body)) record.direction = 'EXPENSE';
  if (record.treatment === 'unknown' && /wakiriye|wohereje|wishyuye/i.test(sms.body)) record.treatment = 'payment';
  if (!record.category && record.direction === 'EXPENSE') {
    record.category = /supermarket|grocery/i.test(person) ? 'Groceries' : /restaurant|cafe/i.test(person) ? 'Food & dining' : /electric|water|utility/i.test(person) ? 'Utilities' : '';
  }
  record.field_confidence = { ...record.field_confidence, sms_sender: sms.sender, sms_received_at: new Date(sms.receivedAt).toISOString(), sms_id: sms.id,
    counterparty: person, counterparty_phone: phone, payment_channel: channel, category: record.category ? 'suggested' : 'missing', source: 'unverified_sms' };
  record.findings.push('Phone receipt timestamp is not the payment timestamp. Confirm the original payment time.');
  if (advert) record.findings.push('Promotional wording accompanies payment wording. Review the original message.');
  if (!completed) record.findings.push('No recognized completed-payment phrase. Review payment status.');
  if (channel === 'person') record.findings.push('Person-to-person movement may be a transfer, gift or loan. Confirm the financial treatment.');
  return { kind: 'review', record };
}

export function compareSmsRecords(a: CaptureRecord, b: CaptureRecord): { relation: 'same_reference' | 'possible_duplicate' | 'distinct'; differences: string[] } {
  const differences = [
    ['amount', a.amount_minor, b.amount_minor], ['time', `${a.occurred_on} ${a.occurred_time}`, `${b.occurred_on} ${b.occurred_time}`],
    ['institution', a.provider, b.provider], ['person', a.field_confidence.counterparty ?? '', b.field_confidence.counterparty ?? ''],
    ['direction', a.direction, b.direction], ['currency', a.currency, b.currency],
  ].filter(([, left, right]) => left !== right).map(([field]) => String(field));
  const sameRef = !!a.reference && a.reference === b.reference && a.provider === b.provider;
  const possible = a.amount_minor !== null && a.amount_minor === b.amount_minor && a.occurred_on !== null && a.occurred_on === b.occurred_on && a.provider === b.provider && a.direction === b.direction && a.currency === b.currency;
  return { relation: sameRef ? 'same_reference' : possible ? 'possible_duplicate' : 'distinct', differences };
}

export function smsEvidence(sms: PhoneSms): string {
  // One stable import per message, independent of batch size or sync retries.
  return JSON.stringify({ sender: sms.sender, receivedAt: sms.receivedAt, body: sms.body });
}