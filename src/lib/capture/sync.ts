import { z } from 'zod';
import { analyzeSms, compareSmsRecords, smsEvidence, type PhoneSms } from './sms';
import type { CaptureRecord } from './parser';

const cursorSchema = z.object({ after: z.number().int().positive(), afterId: z.string().regex(/^\d+$/) });
export type SmsCursor = { after: number; afterId: string };
export type SmsPage = { messages: PhoneSms[]; cursor: SmsCursor; hasMore: boolean };
export function restoreSmsCursor(raw: string | null, now = Date.now()): SmsCursor {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(raw ?? 'null'));
    if (parsed.success && parsed.data.after <= now) return { after: parsed.data.after, afterId: parsed.data.afterId };
  } catch { /* Recover corrupted browser storage without losing the initial lookback. */ }
  return { after: now - 7 * 86400000, afterId: '0' };
}

/** Never checkpoint past an unsuccessful registration. Server evidence hashing makes retries idempotent. */
export async function syncCarrierMessages(options: {
  cursor: SmsCursor;
  read: (cursor: SmsCursor) => Promise<SmsPage>;
  save: (sms: PhoneSms, evidence: string, record: CaptureRecord) => Promise<unknown>;
  checkpoint: (cursor: SmsCursor) => void;
  active?: () => boolean;
}) {
  let cursor = options.cursor;
  const seen: CaptureRecord[] = [];
  const stats = { checked: 0, adverts: 0, unrelated: 0, queued: 0, duplicates: 0, hasMore: true, processed: [] as PhoneSms[] };
  for (let page = 0; page < 10; page++) {
    if (options.active && !options.active()) throw new Error('Phone message syncing was stopped.');
    const result = await options.read(cursor);
    for (const sms of result.messages) {
      if (options.active && !options.active()) throw new Error('Phone message syncing was stopped.');
      stats.checked++;
      const analysis = analyzeSms(sms);
      const record = analysis.record;
      if (analysis.kind === 'advertisement') stats.adverts++;
      else if (!record || analysis.kind === 'unrelated') stats.unrelated++;
      else {
        const duplicate = seen.find(previous => compareSmsRecords(previous, record).relation !== 'distinct');
        if (duplicate) {
          const comparison = compareSmsRecords(duplicate, record);
          record.findings.push(`Possible duplicate in this sync — differs by ${comparison.differences.join(', ') || 'no extracted fields'}.`);
          stats.duplicates++;
        }
        await options.save(sms, smsEvidence(sms), record);
        seen.push(record);
        stats.queued++;
      }
      cursor = { after: sms.receivedAt, afterId: sms.id };
      options.checkpoint(cursor);
      stats.processed.push(sms);
    }
    // The native cursor also covers unrelated rows filtered locally. Only advance after all returned evidence is saved.
    cursor = result.cursor;
    options.checkpoint(cursor);
    stats.hasMore = result.hasMore;
    if (!result.hasMore) break;
  }
  return stats;
}