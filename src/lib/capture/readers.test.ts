import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCaptureFile } from './readers';

const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn() }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: pdf.getDocument,
}));

const file = () => {
  const bytes = new TextEncoder().encode('%PDF-1.7 test');
  return { name: 'statement.pdf', size: bytes.length, arrayBuffer: async () => bytes.buffer } as File;
};

describe('PDF capture reader compatibility', () => {
  beforeEach(() => { vi.resetAllMocks(); pdf.destroy.mockResolvedValue(undefined); });

  it('reads text and releases the loading task without calling document.destroy', async () => {
    const getPage = vi.fn().mockResolvedValue({
      getTextContent: async () => ({ items: [{ str: 'MTN MoMo: You have received 25,000 RWF from Charles. Transaction ID: TX12345. 2026-10-20 10:42.', hasEOL: true }] }),
    });
    pdf.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage }), destroy: pdf.destroy });
    const result = await readCaptureFile(file(), vi.fn());
    expect(result.records[0].amount_minor).toBe(25000);
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
    expect(pdf.getDocument.mock.calls[0][0]).not.toHaveProperty('isEvalSupported');
  });

  it('releases the loading task even when PDF loading fails', async () => {
    pdf.getDocument.mockReturnValue({ promise: Promise.reject(new Error('Invalid PDF')), destroy: pdf.destroy });
    await expect(readCaptureFile(file(), vi.fn())).rejects.toThrow('Invalid PDF');
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
  });
});