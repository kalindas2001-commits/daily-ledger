import jsPDF from 'jspdf';
import { format } from 'date-fns';

const PRIMARY: [number, number, number] = [13, 150, 104];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

const fmt = (n: number) => Number(n).toLocaleString('en-RW', { maximumFractionDigits: 0 });

interface ReceiptOptions {
  title: string;
  receiptNo: string;
  occurredAt: string | Date;
  customerName: string;
  customerEmail?: string;
  rows: { label: string; value: string; emphasize?: boolean }[];
  footerNote?: string;
}

export function generateReceiptPDF(opts: ReceiptOptions) {
  const doc = new jsPDF({ format: [148, 210] }); // A5
  const w = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, w, 30, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(8, 6, 18, 18, 3, 3, 'F');
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CC', 17, 18, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CungaCash', 30, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(opts.title, 30, 21);

  // Receipt info
  let y = 40;
  doc.setTextColor(...INK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Receipt #${opts.receiptNo}`, 10, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(format(new Date(opts.occurredAt), 'EEE, MMM d, yyyy · HH:mm'), w - 10, y, { align: 'right' });

  y += 8;
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.line(10, y, w - 10, y);
  y += 6;

  // Customer
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text('CUSTOMER', 10, y);
  y += 5;
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.customerName, 10, y);
  if (opts.customerEmail) {
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(opts.customerEmail, 10, y);
  }

  y += 10;
  doc.setDrawColor(220);
  doc.line(10, y, w - 10, y);
  y += 8;

  // Rows
  for (const r of opts.rows) {
    doc.setFontSize(r.emphasize ? 11 : 9);
    doc.setFont('helvetica', r.emphasize ? 'bold' : 'normal');
    doc.setTextColor(...(r.emphasize ? PRIMARY : MUTED));
    doc.text(r.label, 10, y);
    doc.setTextColor(...INK);
    doc.text(r.value, w - 10, y, { align: 'right' });
    y += r.emphasize ? 8 : 6;
  }

  y += 4;
  doc.setDrawColor(220);
  doc.line(10, y, w - 10, y);
  y += 8;

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'italic');
  if (opts.footerNote) {
    doc.text(opts.footerNote, w / 2, y, { align: 'center', maxWidth: w - 20 });
    y += 5;
  }
  doc.text('Thank you for using CungaCash', w / 2, y, { align: 'center' });
  y += 4;
  doc.text('Powered by rossets.rw · info@rossets.rw', w / 2, y, { align: 'center' });

  doc.save(`${opts.title.replace(/\s+/g, '_')}_${opts.receiptNo}.pdf`);
}

export { fmt as formatCurrency };
