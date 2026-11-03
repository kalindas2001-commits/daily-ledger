import { parseRwf, type CaptureRecord } from './parser';

export interface StatementCheck {
  status: 'balanced' | 'discrepancy' | 'incomplete';
  opening: number | null;
  closing: number | null;
  expectedClosing: number | null;
  difference: number | null;
  checkedTransitions: number;
  discrepancies: { row: number; expected: number; actual: number; difference: number }[];
}

// Balances may legitimately be zero or negative; payment amounts may not.
function balance(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim().replace(/^(RWF|FRW)\s*|\s*(RWF|FRW)$/gi, '').replace(/\s/g, '');
  if (!/^-?\d+(?:,\d{3})*(?:\.0{1,2})?$/.test(raw)) return null;
  const result = Number(raw.replace(/,/g, ''));
  return Number.isSafeInteger(result) && Math.abs(result) <= 1_000_000_000_000 ? result : null;
}
function emptyOrZero(value: string | undefined) {
  return !value?.trim() || balance(value) === 0;
}
function movement(row: Record<string, string>): number | null {
  if (row.currency && !/^(RWF|FRW)$/i.test(row.currency.trim())) return null;
  const state = `${row.status ?? ''} ${row.type ?? ''} ${row.direction ?? ''}`;
  if (/failed|pending|declined|revers|refund|chargeback|transfer|withdraw|invoice|loan/i.test(state)) return null;
  const credit = parseRwf(row.credit ?? '');
  const debit = parseRwf(row.debit ?? '');
  if (credit !== null && emptyOrZero(row.debit)) return credit;
  if (debit !== null && emptyOrZero(row.credit)) return -debit;
  const amount = parseRwf(row.amount ?? '');
  if (amount === null || !emptyOrZero(row.credit) || !emptyOrZero(row.debit)) return null;
  if (/^(income|credit|incoming)$/i.test(row.type ?? row.direction ?? '')) return amount;
  if (/^(expense|debit|outgoing)$/i.test(row.type ?? row.direction ?? '')) return -amount;
  return null;
}

export function checkStatement(rows: Record<string, unknown>[]): StatementCheck {
  const values = rows.filter(row => Object.values(row).some(value => value !== '' && value != null))
    .map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value ?? '').trim()])));
  const openings = values.filter(row => row.opening_balance).map(row => balance(row.opening_balance));
  const closings = values.filter(row => row.closing_balance).map(row => balance(row.closing_balance));
  const consistent = (items: (number | null)[]) => items.length > 0 && items[0] !== null && items.every(item => item === items[0]);
  const opening = consistent(openings) ? openings[0] ?? null : null;
  const closing = consistent(closings) ? closings[0] ?? null : null;
  let previous = opening;
  let total = 0;
  let complete = values.length > 0;
  let checkedTransitions = 0;
  const discrepancies: StatementCheck['discrepancies'] = [];
  values.forEach((row, index) => {
    const delta = movement(row);
    const actual = balance(row.running_balance ?? row.balance);
    if (delta === null) complete = false;
    else total += delta;
    if (previous !== null && actual !== null && delta !== null) {
      const expected = previous + delta;
      checkedTransitions++;
      if (actual !== expected) discrepancies.push({ row: index + 1, expected, actual, difference: actual - expected });
    }
    // Do not bridge an unknown row or infer an opening balance from a payment.
    previous = actual;
  });
  const expectedClosing = complete && opening !== null ? opening + total : null;
  const difference = expectedClosing !== null && closing !== null ? closing - expectedClosing : null;
  const fullCheck = difference !== null;
  const conflictingMetadata = openings.length > 0 && !consistent(openings) || closings.length > 0 && !consistent(closings);
  const status = discrepancies.length > 0 || difference !== null && difference !== 0 ? 'discrepancy'
    : complete && fullCheck && !conflictingMetadata ? 'balanced' : 'incomplete';
  return { status, opening, closing, expectedClosing, difference, checkedTransitions, discrepancies };
}

export function preserveStatementChecks(records: CaptureRecord[], check: StatementCheck): CaptureRecord[] {
  return records.map((record, index) => ({ ...record, findings: [...record.findings,
    ...(check.status === 'discrepancy' ? ['Statement balance discrepancy detected. Verify the original statement before posting.'] : []),
    ...(check.status === 'incomplete' ? ['Full statement balance check unavailable; source balances or supported movements are incomplete.'] : []),
    ...check.discrepancies.filter(item => item.row === index + 1).map(item => `Running balance mismatch: expected ${item.expected} RWF, source ${item.actual} RWF; difference ${item.difference} RWF.`),
  ] }));
}

export function summarizeCapture(records: CaptureRecord[]) {
  const income = records.filter(record => record.currency === 'RWF' && record.direction === 'INCOME' && record.treatment === 'payment');
  const expenses = records.filter(record => record.currency === 'RWF' && record.direction === 'EXPENSE' && record.treatment === 'payment');
  const total = (items: CaptureRecord[]) => items.reduce((sum, record) => sum + (record.amount_minor ?? 0), 0);
  return { income: total(income), expenses: total(expenses), exceptions: records.filter(record => record.currency !== 'RWF' || record.treatment !== 'payment' || !record.direction || !record.amount_minor || !record.occurred_on).length };
}