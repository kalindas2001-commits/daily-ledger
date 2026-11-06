import { describe, expect, it, vi } from 'vitest';
import { restoreSmsCursor, syncCarrierMessages } from './sync';

const initial = { after: Date.parse('2026-11-04T00:00:00Z'), afterId: '0' };
const sms = (id: string) => ({ id, sender: 'MTN MoMo', body: `You received RWF 5000 from Charles. Ref: TX${id}0000. 2026-11-04 06:10.`, receivedAt: initial.after + Number(id) * 1000 });
describe('Carrier SMS synchronization', () => {
  it('restores a seven-day lookback when storage is damaged', () => {
    expect(restoreSmsCursor('{broken', initial.after)).toEqual({ after: initial.after - 7 * 86400000, afterId: '0' });
  });
  it('never checkpoints past a payment that could not be saved', async () => {
    const checkpoint = vi.fn();
    await expect(syncCarrierMessages({ cursor: initial, read: async () => ({ messages: [sms('1'), sms('2')], cursor: { after: initial.after + 5000, afterId: '5' }, hasMore: false }), save: async message => { if (message.id === '2') throw new Error('Offline'); }, checkpoint })).rejects.toThrow('Offline');
    expect(checkpoint.mock.calls).toEqual([[{ after: initial.after + 1000, afterId: '1' }]]);
  });
  it('leaves adverts on the phone rather than importing them', async () => {
    const save = vi.fn();
    const stats = await syncCarrierMessages({ cursor: initial, read: async () => ({ messages: [{ ...sms('1'), body: 'Win RWF 5000 in our promo! Subscribe now.' }], cursor: initial, hasMore: false }), save, checkpoint: vi.fn() });
    expect(stats.adverts).toBe(1); expect(save).not.toHaveBeenCalled();
  });
  it('stops before uploading when permission or consent is withdrawn', async () => {
    const save = vi.fn();
    await expect(syncCarrierMessages({ cursor: initial, read: async () => ({ messages: [sms('1')], cursor: initial, hasMore: false }), save, checkpoint: vi.fn(), active: () => false })).rejects.toThrow('stopped');
    expect(save).not.toHaveBeenCalled();
  });
  it('imports from the carrier reader, with original evidence and pending review treatment', async () => {
    const save = vi.fn();
    const stats = await syncCarrierMessages({ cursor: initial, read: async () => ({ messages: [sms('1')], cursor: initial, hasMore: false }), save, checkpoint: vi.fn() });
    expect(stats.queued).toBe(1);
    expect(JSON.parse(save.mock.calls[0][1])).toEqual({ sender: 'MTN MoMo', receivedAt: sms('1').receivedAt, body: sms('1').body });
    expect(save.mock.calls[0][2]).toMatchObject({ direction: 'INCOME', amount_minor: 5000, field_confidence: { source: 'unverified_sms' } });
  });
});