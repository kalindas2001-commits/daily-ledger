import {describe,it,expect} from 'vitest';
import {parseMessage,parseRwf,parseStatementRows,normalizeDate} from './parser';
describe('Money Capture safety',()=>{
 it('extracts MTN payment without confusing balance or fees',()=>{const r=parseMessage('MTN MoMo: You have received 25,000 RWF from Charles. Transaction ID: TX12345. 2026-10-20 10:42. Balance 80,000 RWF. Fee 500 RWF'); expect(r.amount_minor).toBe(25000);expect(r.direction).toBe('INCOME');expect(r.reference).toBe('TX12345');expect(r.occurred_on).toBe('2026-10-20');expect(r.occurred_time).toBe('10:42:00');});
 it('extracts Airtel independently',()=>{const r=parseMessage('Airtel Money: You paid RWF 8,500. Ref: AR12345 on 2026-10-20');expect(r.provider).toBe('Airtel Money');expect(r.amount_minor).toBe(8500);expect(r.direction).toBe('EXPENSE');});
 it('never interprets a balance notification as income',()=>{const r=parseMessage('MTN MoMo balance RWF 20000');expect(r.amount_minor).toBeNull();expect(r.direction).toBeNull();expect(r.treatment).toBe('balance');});
 it('keeps failed payments out of completed activity',()=>{const r=parseMessage('MTN payment RWF 5000 failed');expect(r.direction).toBeNull();expect(r.treatment).toBe('failed');});
 it('separates withdrawal principal from fee',()=>{const r=parseMessage('MTN withdrawal RWF 20,000. Fee RWF 500. Balance RWF 60000');expect(r.amount_minor).toBe(20000);expect(r.treatment).toBe('withdrawal');expect(r.findings.some(f=>f.includes('Fee mentioned'))).toBe(true);});
 it('does not post an unpaid invoice as a payment',()=>{expect(parseMessage('Invoice total RWF 10000 awaiting payment').treatment).toBe('invoice');});
 it('rejects ambiguous currency decimals rather than rounding',()=>{expect(parseRwf('8.500')).toBeNull();expect(parseRwf('8,500')).toBe(8500);expect(parseRwf('8,500.25')).toBeNull();});
 it('preserves real identical payments as separate candidates',()=>{const rows=parseStatementRows([{date:'2026-10-20',debit:'15000',reference:'A'},{date:'2026-10-20',debit:'15000',reference:'B'}]);expect(rows).toHaveLength(2);expect(rows[0].reference).not.toBe(rows[1].reference);});
 it('rejects invalid and ambiguous dates',()=>{expect(normalizeDate('2026-02-30')).toBeNull();expect(normalizeDate('10/11/2026')).toBeNull();});
 it('never guesses an unsupported message direction',()=>{const r=parseMessage('Account update RWF 25000');expect(r.direction).toBeNull();expect(r.treatment).toBe('unknown');});
});
