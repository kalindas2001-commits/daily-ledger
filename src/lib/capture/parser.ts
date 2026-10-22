export const PARSER_VERSION = 'rw-capture/1.0.0';
export interface CaptureRecord {
  amount_minor: number | null; currency: string; direction: string | null; treatment: string;
  occurred_on: string | null; occurred_time: string | null; provider: string; reference: string | null;
  description: string; category: string; evidence_excerpt: string; findings: string[];
  field_confidence: Record<string, string>;
}
export function parseRwf(value: string): number | null {
  const cleaned = value.trim().replace(/\s/g, '').replace(/^(RWF|FRW)\s*|\s*(RWF|FRW)$/gi, '');
  if (!/^\d+(?:,\d{3})*(?:\.0{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned.replace(/,/g, ''));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000_000_000 ? amount : null;
}
export function normalizeDate(value: string): string | null {
  const m = value.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? date : null;
}
export function parseMessage(text: string): CaptureRecord {
  const provider = /airtel/i.test(text) ? 'Airtel Money' : /\bmtn\b|\bmomo\b|mobile money/i.test(text) ? 'MTN MoMo' : 'Unknown';
  const failed = /\bfailed\b|unsuccessful|declined|pending/i.test(text);
  const balanceOnly = /balance/i.test(text) && !/received|sent|paid|payment|withdraw|deposit/i.test(text);
  const treatment = failed ? 'failed' : balanceOnly ? 'balance' : /revers|refund/i.test(text) ? 'reversal' : /\bloan\b|repay/i.test(text) ? 'loan' : /withdraw/i.test(text) ? 'withdrawal' : /transfer/i.test(text) ? 'transfer' : /invoice/i.test(text) && !/paid/i.test(text) ? 'invoice' : /\bfee\b/i.test(text) && !/received|sent|paid|payment|withdraw/i.test(text) ? 'fee' : /received|sent|paid|payment|purchase|deposit/i.test(text) ? 'payment' : 'unknown';
  const direction = balanceOnly || failed ? null : /received|credited|deposit/i.test(text) ? 'INCOME' : /sent|paid|payment|debited|purchase|withdraw/i.test(text) ? 'EXPENSE' : null;
  // Anchor the event amount before any balance/fee so a balance can never become income.
  const event = text.split(/\bbalance\b|\bfee\b|\bcharges\b/i)[0];
  const amountMatch = event.match(/(?:RWF|FRW)\s*([\d,]+(?:\.\d{1,2})?)/i) ?? event.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:RWF|FRW)/i);
  const amount = !balanceOnly && amountMatch ? parseRwf(amountMatch[1]) : null;
  const reference = text.match(/(?:transaction\s*(?:id|ref(?:erence)?)|txid|ref(?:erence)?)\s*[:#=]?\s*([A-Z0-9-]{4,100})/i)?.[1] ?? null;
  const date = normalizeDate(text);
  const time = text.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  const findings: string[] = [];
  if (provider === 'Unknown') findings.push('Unrecognized source template; verify every field.');
  if (!amount) findings.push('Amount missing or ambiguous.');
  if (!date) findings.push('Event date missing or ambiguous; choose the actual payment date.');
  if (!direction) findings.push('Payment direction needs confirmation.');
  if (!reference) findings.push('No provider reference; duplicate review required.');
  if (treatment !== 'payment' && treatment !== 'fee') findings.push(`Financial treatment: ${treatment}. Do not treat this as a routine payment.`);
  if (/\bfee\b|charges/i.test(text) && treatment !== 'fee') findings.push('Fee mentioned; verify and record any separate fee independently.');
  findings.push('User-imported evidence is not provider-verified.');
  return { amount_minor: amount, currency: /\bUSD\b|\bEUR\b/i.test(text) ? (text.match(/\b(USD|EUR)\b/i)?.[1].toUpperCase() ?? 'RWF') : 'RWF', direction, treatment, occurred_on: date, occurred_time: time ? `${time[1]}:${time[2]}:${time[3] ?? '00'}` : null, provider, reference, description: event.trim().slice(0, 1000), category: '', evidence_excerpt: text.slice(0,4000), findings, field_confidence: { amount: amount ? 'extracted' : 'missing', date: date ? 'extracted' : 'missing', direction: direction ? 'suggested' : 'missing', source: 'unverified' } };
}
export function parseText(text: string): CaptureRecord[] {
  return text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(parseMessage);
}
export function parseStatementRows(rows: Record<string, unknown>[]): CaptureRecord[] {
  return rows.filter(row => Object.values(row).some(v => v !== '' && v != null)).map(row => {
    const r = Object.fromEntries(Object.entries(row).map(([k,v]) => [k.trim().toLowerCase(), String(v ?? '')]));
    const incoming = parseRwf(r.credit ?? ''); const outgoing = parseRwf(r.debit ?? '');
    const original = JSON.stringify(row);
    const base = parseMessage(Object.values(r).join(' '));
    const amount = incoming ?? outgoing ?? parseRwf(r.amount ?? '');
    const direction = incoming && !outgoing ? 'INCOME' : outgoing && !incoming ? 'EXPENSE' : /^(income|credit|incoming)$/i.test(r.type ?? r.direction ?? '') ? 'INCOME' : /^(expense|debit|outgoing)$/i.test(r.type ?? r.direction ?? '') ? 'EXPENSE' : null;
    return { ...base, amount_minor: amount, direction, currency: (r.currency || 'RWF').toUpperCase(), occurred_on: normalizeDate(r.date ?? r.transaction_date ?? ''), occurred_time: null, reference: r.reference || r.transaction_reference || base.reference, description: r.description || r.merchant || base.description, category: r.category || '', treatment: /failed|pending|reversal|transfer|withdrawal|invoice|loan/i.test(r.status ?? r.type ?? '') ? 'unknown_special' : 'payment', evidence_excerpt: original, findings: [...(incoming && outgoing ? ['Both debit and credit present; review direction.'] : []), 'Statement row: verify payment status, date and account.'], field_confidence: { amount: amount ? 'extracted' : 'missing', direction: direction ? 'extracted' : 'missing', source: 'unverified' } };
  });
}
