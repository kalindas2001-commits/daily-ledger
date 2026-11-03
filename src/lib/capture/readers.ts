import Papa from 'papaparse';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseText, parseStatementRows, type CaptureRecord } from './parser';
import { checkStatement, preserveStatementChecks, type StatementCheck } from './statement';
export interface CaptureReadResult { text: string; records: CaptureRecord[]; statementChecks?: StatementCheck[] }
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export interface CaptureProgress { stage: 'reading' | 'ocr'; page?: number; pages?: number; percent?: number }
export function validateCaptureFile(file: Pick<File, 'size' | 'name'>) {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Select a nonempty file up to 10 MB.');
  if (!/\.(txt|csv|xlsx|pdf|jpg|jpeg|png|webp)$/i.test(file.name)) throw new Error('Supported files: TXT, CSV, XLSX, PDF, JPG, PNG and WEBP.');
}
export async function readCaptureFile(file: File, progress: (state: CaptureProgress) => void): Promise<CaptureReadResult> {
  validateCaptureFile(file);
  progress({ stage: 'reading' });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split('.').pop()?.toLowerCase();
  let text = ''; let records: CaptureRecord[] | undefined;
  let statementChecks: StatementCheck[] | undefined;
  if (ext === 'txt' || ext === 'csv') {
    if (bytes.includes(0)) throw new Error('This is not a supported text file.');
    text = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    if (ext === 'csv') { const parsed = Papa.parse<Record<string,string>>(text, {header:true,skipEmptyLines:true}); if (parsed.errors.length) throw new Error('CSV rows are malformed. Check headers and separators.'); const check = checkStatement(parsed.data); statementChecks = [check]; records = preserveStatementChecks(parseStatementRows(parsed.data), check); }
  } else if (ext === 'xlsx') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Invalid spreadsheet signature.');
    // Inspect ZIP entry sizes before decompressing the workbook.
    const data = new DataView(bytes.buffer); let total = 0; let entries = 0;
    for(let i=0;i+46<bytes.length;i++) if(data.getUint32(i,true)===0x02014b50) { const size=data.getUint32(i+24,true); total+=size; entries++; const n=data.getUint16(i+28,true); const name=new TextDecoder().decode(bytes.slice(i+46,i+46+n)); if(/vba|externalLinks/i.test(name)) throw new Error('Macros and external workbook links are not supported.'); }
    if(total>30*1024*1024 || entries>2000 || !entries) throw new Error('Spreadsheet is too large to safely unpack.');
    const XLSX = await import('xlsx'); const workbook = XLSX.read(bytes, {type:'array',cellFormula:false,cellHTML:false,cellText:true,raw:true});
    if(workbook.SheetNames.length>10) throw new Error('Use a workbook with at most 10 sheets.');
    const sheets = workbook.SheetNames.map(name => XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[name], {raw:false}));
    const rows = sheets.flat();
    if(rows.length>200) throw new Error('Import at most 200 statement rows at a time.');
    statementChecks = sheets.filter(sheet => sheet.length > 0).map(checkStatement);
    text=JSON.stringify(rows); records=sheets.flatMap(sheet => preserveStatementChecks(parseStatementRows(sheet), checkStatement(sheet)));
  } else if(ext==='pdf') {
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new Error('Invalid PDF signature.');
    const pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
    const loadingTask=pdfjs.getDocument({data:bytes,enableXfa:false});
    let ocrWorker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | undefined;
    let currentPage = 1;
    let pageCount = 1;
    try { const pdf=await loadingTask.promise;
      if(pdf.numPages>20) throw new Error('Import a PDF with at most 20 pages.');
      pageCount = pdf.numPages;
      for(let p=1;p<=pdf.numPages;p++) {
        currentPage = p;
        progress({ stage: 'reading', page: p, pages: pageCount });
        const page=await pdf.getPage(p);
        try {
          const content=await page.getTextContent();
          let pageText=content.items.map(item=>'str' in item ? item.str+('hasEOL' in item && item.hasEOL?'\n':' '):'').join('');
          if(pageText.trim().length<20) {
            progress({ stage: 'ocr', page: p, pages: pageCount, percent: 0 });
            if(!ocrWorker) {
              const {createWorker}=await import('tesseract.js');
              ocrWorker=await createWorker('eng', undefined, { logger: state => {
                if(state.status === 'recognizing text') progress({ stage: 'ocr', page: currentPage, pages: pageCount, percent: Math.round(state.progress * 100) });
              }});
            }
            const original=page.getViewport({scale:1});
            const scale=Math.min(2, 2400/Math.max(original.width,original.height));
            const viewport=page.getViewport({scale});
            const canvas=document.createElement('canvas');
            canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
            try {
              const context=canvas.getContext('2d');
              if(!context) throw new Error('Receipt image could not be prepared.');
              await page.render({canvas,canvasContext:context,viewport}).promise;
              pageText=(await ocrWorker.recognize(canvas)).data.text;
            } finally {canvas.width=0;canvas.height=0;}
          }
          text+=`\n\n${pageText}`;
          if(new TextEncoder().encode(text).length>1000000) throw new Error('Extracted text exceeds 1 MB. Import a smaller file.');
        } finally {page.cleanup();}
      }
      if(text.trim().length<20) throw new Error('Receipt text could not be read. Try a clearer photograph.');
    } finally { try {if(ocrWorker) await ocrWorker.terminate();} finally {await loadingTask.destroy();} }
  } else if(['jpg','jpeg','png','webp'].includes(ext ?? '')) {
    const valid=bytes[0]===0xff && bytes[1]===0xd8 || bytes[0]===0x89 && bytes[1]===0x50 || new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!valid) throw new Error('Invalid receipt image signature.');
    const bitmap=await createImageBitmap(file); const pixels=bitmap.width*bitmap.height; bitmap.close(); if(pixels>25000000) throw new Error('Receipt image exceeds 25 megapixels.');
    progress({stage:'ocr',percent:0}); const {createWorker}=await import('tesseract.js'); const worker=await createWorker('eng',undefined,{logger: state => {if(state.status==='recognizing text') progress({stage:'ocr',percent:Math.round(state.progress*100)});}});
    try { const result=await worker.recognize(file); text=result.data.text; } finally {await worker.terminate();}
    if(text.trim().length<10) throw new Error('Receipt text could not be read. Try a clearer photograph.');
  } else throw new Error('Supported files: TXT, CSV, XLSX, PDF, JPG, PNG and WEBP.');
  if(new TextEncoder().encode(text).length>1000000) throw new Error('Extracted text exceeds 1 MB. Import a smaller file.');
  const candidates=records ?? parseText(text);
  if(!candidates.length || candidates.length>200) throw new Error('Import 1–200 records at a time.');
  return {text,records:candidates,statementChecks};
}
