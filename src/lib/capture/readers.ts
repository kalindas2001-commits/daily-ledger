import Papa from 'papaparse';
import { parseText, parseStatementRows, type CaptureRecord } from './parser';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export async function readCaptureFile(file: File, progress: (message: string) => void): Promise<{text: string; records: CaptureRecord[]}> {
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Select a nonempty file up to 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split('.').pop()?.toLowerCase();
  let text = ''; let records: CaptureRecord[] | undefined;
  if (ext === 'txt' || ext === 'csv') {
    if (bytes.includes(0)) throw new Error('This is not a supported text file.');
    text = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
    if (ext === 'csv') { const parsed = Papa.parse<Record<string,string>>(text, {header:true,skipEmptyLines:true}); if (parsed.errors.length) throw new Error('CSV rows are malformed. Check headers and separators.'); records = parseStatementRows(parsed.data); }
  } else if (ext === 'xlsx') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Invalid spreadsheet signature.');
    // Inspect ZIP entry sizes before decompressing the workbook.
    const data = new DataView(bytes.buffer); let total = 0; let entries = 0;
    for(let i=0;i+46<bytes.length;i++) if(data.getUint32(i,true)===0x02014b50) { const size=data.getUint32(i+24,true); total+=size; entries++; const n=data.getUint16(i+28,true); const name=new TextDecoder().decode(bytes.slice(i+46,i+46+n)); if(/vba|externalLinks/i.test(name)) throw new Error('Macros and external workbook links are not supported.'); }
    if(total>30*1024*1024 || entries>2000 || !entries) throw new Error('Spreadsheet is too large to safely unpack.');
    const XLSX = await import('xlsx'); const workbook = XLSX.read(bytes, {type:'array',cellFormula:false,cellHTML:false,cellText:true,raw:true});
    if(workbook.SheetNames.length>10) throw new Error('Use a workbook with at most 10 sheets.');
    const rows = workbook.SheetNames.flatMap(name => XLSX.utils.sheet_to_json<Record<string,unknown>>(workbook.Sheets[name], {raw:false}));
    if(rows.length>200) throw new Error('Import at most 200 statement rows at a time.');
    text=JSON.stringify(rows); records=parseStatementRows(rows);
  } else if(ext==='pdf') {
    if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new Error('Invalid PDF signature.');
    const pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();
    const pdf=await pdfjs.getDocument({data:bytes,isEvalSupported:false,enableXfa:false}).promise;
    try { if(pdf.numPages>20) throw new Error('Import a PDF with at most 20 pages.');
      for(let p=1;p<=pdf.numPages;p++) {progress(`Reading page ${p} of ${pdf.numPages}`); const page=await pdf.getPage(p); const content=await page.getTextContent(); text+=`\n\n${content.items.map(item=>'str' in item ? item.str+('hasEOL' in item && item.hasEOL?'\n':' '):'').join('')}`; }
      if(text.trim().length<20) throw new Error('This PDF is scanned. Import individual pages as receipt images for OCR.');
    } finally { await pdf.destroy(); }
  } else if(['jpg','jpeg','png','webp'].includes(ext ?? '')) {
    const valid=bytes[0]===0xff && bytes[1]===0xd8 || bytes[0]===0x89 && bytes[1]===0x50 || new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!valid) throw new Error('Invalid receipt image signature.');
    const bitmap=await createImageBitmap(file); const pixels=bitmap.width*bitmap.height; bitmap.close(); if(pixels>25000000) throw new Error('Receipt image exceeds 25 megapixels.');
    progress('Reading receipt text…'); const {createWorker}=await import('tesseract.js'); const worker=await createWorker('eng');
    try { const result=await worker.recognize(file); text=result.data.text; } finally {await worker.terminate();}
    if(text.trim().length<10) throw new Error('Receipt text could not be read. Try a clearer photograph.');
  } else throw new Error('Supported files: TXT, CSV, XLSX, PDF, JPG, PNG and WEBP.');
  if(new TextEncoder().encode(text).length>1000000) throw new Error('Extracted text exceeds 1 MB. Import a smaller file.');
  const candidates=records ?? parseText(text);
  if(!candidates.length || candidates.length>200) throw new Error('Import 1–200 records at a time.');
  return {text,records:candidates};
}
