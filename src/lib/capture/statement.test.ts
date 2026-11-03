import { describe, expect, it } from 'vitest';
import { parseStatementRows } from './parser';
import { checkStatement, preserveStatementChecks, summarizeCapture } from './statement';

describe('statement reconciliation', () => {
  const rows = [
    { date: '2026-10-20', opening_balance: '100,000', credit: '25,000', debit: '', balance: '125,000' },
    { date: '2026-10-21', credit: '', debit: '15,000', balance: '110,000', closing_balance: '110,000' },
  ];
  it('checks opening plus credits minus debits against the closing balance', () => {
    expect(checkStatement(rows)).toMatchObject({ status: 'balanced', opening: 100000, closing: 110000, expectedClosing: 110000, difference: 0, checkedTransitions: 2 });
  });
  it('flags an incorrect closing balance without changing extracted entries', () => {
    const wrong = [rows[0], { ...rows[1], closing_balance: '109,000' }];
    const check = checkStatement(wrong);
    const records = preserveStatementChecks(parseStatementRows(wrong), check);
    expect(check).toMatchObject({ status: 'discrepancy', difference: -1000 });
    expect(records.map(record => record.amount_minor)).toEqual([25000, 15000]);
    expect(records[1].findings).toContain('Statement balance discrepancy detected. Verify the original statement before posting.');
  });
  it('identifies the original row with an incorrect running balance', () => {
    expect(checkStatement([rows[0], { ...rows[1], balance: '111,000' }]).discrepancies).toEqual([{ row: 2, expected: 110000, actual: 111000, difference: 1000 }]);
  });
  it('does not claim a full check when opening and closing balances are absent', () => {
    expect(checkStatement([{ credit: '25000', balance: '125000' }, { debit: '15000', balance: '110000' }])).toMatchObject({ status: 'incomplete', checkedTransitions: 1, difference: null });
  });
  it('supports zero opening and negative closing balances', () => {
    expect(checkStatement([{ opening_balance: '0', debit: '15000', balance: '-15000', closing_balance: '-15000' }])).toMatchObject({ status: 'balanced', difference: 0 });
  });
  it.each(['pending', 'failed', 'reversal', 'chargeback'])('leaves %s entries out of verified reconciliation', status => {
    expect(checkStatement([{ opening_balance: '0', credit: '25000', closing_balance: '25000', status }]).status).toBe('incomplete');
  });
  it('does not mix unsupported currency into RWF checks', () => {
    expect(checkStatement([{ opening_balance: '100000', credit: '25', currency: 'USD', closing_balance: '100025' }]).status).toBe('incomplete');
  });
  it('leaves conflicting and ambiguous columns for review', () => {
    expect(checkStatement([{ opening_balance: '0', credit: '25000', debit: '15000', closing_balance: '10000' }]).status).toBe('incomplete');
    expect(checkStatement([{ opening_balance: '0', credit: '25.000', closing_balance: '25000' }]).status).toBe('incomplete');
  });
  it('excludes pending entries from the extracted payment summary', () => {
    const records = parseStatementRows([{ date: '2026-10-20', credit: '25000' }, { date: '2026-10-20', debit: '15000' }, { date: '2026-10-20', credit: '90000', status: 'pending' }]);
    expect(summarizeCapture(records)).toEqual({ income: 25000, expenses: 15000, exceptions: 1 });
  });
});