import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_FILE_BYTES, readCaptureFile, validateCaptureFile } from './readers';

const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn() }));
const ocr = vi.hoisted(() => ({ createWorker: vi.fn(), recognize: vi.fn(), terminate: vi.fn() }));
vi.mock('tesseract.js', () => ({ createWorker: ocr.createWorker }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: pdf.getDocument,
}));

const file = () => {
  const bytes = new TextEncoder().encode('%PDF-1.7 test');
  return { name: 'statement.pdf', size: bytes.length, arrayBuffer: async () => bytes.buffer } as File;
};

describe('PDF capture reader compatibility', () => {
  beforeEach(() => { vi.resetAllMocks(); pdf.destroy.mockResolvedValue(undefined); ocr.terminate.mockResolvedValue(undefined); ocr.createWorker.mockResolvedValue({recognize:ocr.recognize,terminate:ocr.terminate}); });

  it('reads text and releases the loading task without calling document.destroy', async () => {
    const getPage = vi.fn().mockResolvedValue({
      getTextContent: async () => ({ items: [{ str: 'MTN MoMo: You have received 25,000 RWF from Charles. Transaction ID: TX12345. 2026-10-20 10:42.', hasEOL: true }] }),
      cleanup: vi.fn(),
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

  it('reads scanned pages through bounded OCR and preserves the extracted payment amount', async () => {
    const context = vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({} as CanvasRenderingContext2D);
    const cleanup=vi.fn(); const render=vi.fn().mockReturnValue({promise:Promise.resolve()});
    const getPage=vi.fn().mockResolvedValue({getTextContent:async()=>({items:[]}),getViewport:({scale}:{scale:number})=>({width:2000*scale,height:3000*scale}),render,cleanup});
    pdf.getDocument.mockReturnValue({promise:Promise.resolve({numPages:2,getPage}),destroy:pdf.destroy});
    ocr.recognize.mockResolvedValue({data:{text:'MTN MoMo: You have received 25,000 RWF from Charles. Transaction ID: TX12345. 2026-10-20 10:42.'}});
    try {
      const result=await readCaptureFile(file(),vi.fn());
      expect(result.records[0].amount_minor).toBe(25000);
      expect(ocr.createWorker).toHaveBeenCalledTimes(1);
      expect(ocr.recognize).toHaveBeenCalledTimes(2);
      expect(render.mock.calls[0][0].viewport.height).toBe(2400);
      expect(cleanup).toHaveBeenCalledTimes(2);
      expect(ocr.terminate).toHaveBeenCalledTimes(1);
      expect(pdf.destroy).toHaveBeenCalledTimes(1);
    } finally {context.mockRestore();}
  });

  it('rejects PDFs above the 20-page limit before OCR', async () => {
    pdf.getDocument.mockReturnValue({promise:Promise.resolve({numPages:21}),destroy:pdf.destroy});
    await expect(readCaptureFile(file(),vi.fn())).rejects.toThrow('at most 20 pages');
    expect(ocr.createWorker).not.toHaveBeenCalled();
    expect(pdf.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('selected document safeguards',()=>{
  it('rejects files over 10 MB',()=>{expect(()=>validateCaptureFile({name:'receipt.png',size:MAX_FILE_BYTES+1})).toThrow('10 MB');});
  it('rejects empty files',()=>{expect(()=>validateCaptureFile({name:'receipt.png',size:0})).toThrow('nonempty');});
  it('rejects unsupported executable files',()=>{expect(()=>validateCaptureFile({name:'receipt.exe',size:100})).toThrow('Supported files');});
});