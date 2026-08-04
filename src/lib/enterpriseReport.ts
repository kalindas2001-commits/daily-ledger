/**
 * CungaCash Enterprise Report Builder
 * Boardroom-quality PDF scaffold: cover, confidentiality, TOC, executive summary,
 * KPIs, sections, notes, approvals, QR verification, appendix, metadata, footers.
 */
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { format } from 'date-fns';

// --- Brand palette ---
export const NAVY: [number, number, number] = [11, 37, 69];
export const EMERALD: [number, number, number] = [13, 150, 104];
export const GOLD: [number, number, number] = [184, 134, 11];
export const CHARCOAL: [number, number, number] = [31, 41, 55];
export const MUTED: [number, number, number] = [100, 116, 139];
export const LIGHT: [number, number, number] = [241, 245, 249];
export const EXPENSE: [number, number, number] = [220, 38, 38];

export interface ReportMeta {
  reportType: string;               // e.g. "Profit & Loss Statement"
  company: string;
  branch?: string;
  periodFrom: Date;
  periodTo: Date;
  currency: string;                 // "RWF"
  generatedBy: string;
  generatedByEmail?: string;
  reportId: string;                 // CC-XX-YYYY-######
  confidentiality: 'CONFIDENTIAL' | 'DRAFT' | 'FINAL' | 'INTERNAL';
  version: string;                  // "1.0"
  revision: number;                 // 0
  auditTrailId: string;
  deviceName: string;
  userId: string;
  watermark?: 'CONFIDENTIAL' | 'DRAFT' | 'FINAL' | null;
  supportEmail?: string;
  website?: string;
}

export interface TocEntry { title: string; page: number }

export class EnterpriseReport {
  doc: jsPDF;
  meta: ReportMeta;
  toc: TocEntry[] = [];
  documentHash = '';
  qrDataUrl = '';
  private hashPayload: string[] = [];

  constructor(meta: ReportMeta) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' });
    this.meta = meta;
  }

  get pageW() { return this.doc.internal.pageSize.getWidth(); }
  get pageH() { return this.doc.internal.pageSize.getHeight(); }

  addToHash(s: string) { this.hashPayload.push(s); }

  async computeHash() {
    const payload = [
      this.meta.reportId, this.meta.reportType, this.meta.company,
      this.meta.periodFrom.toISOString(), this.meta.periodTo.toISOString(),
      this.meta.generatedBy, this.meta.userId, ...this.hashPayload,
    ].join('|');
    const enc = new TextEncoder().encode(payload);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const bytes = Array.from(new Uint8Array(buf));
    this.documentHash = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    return this.documentHash;
  }

  async buildQr(url?: string) {
    const verifyUrl = url ?? `https://cungacash.com/verify?id=${this.meta.reportId}&h=${this.documentHash.slice(0, 16)}`;
    this.qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, color: { dark: '#0B2545', light: '#FFFFFF' } });
    return { url: verifyUrl, dataUrl: this.qrDataUrl };
  }

  // ---------- Primitives ----------
  private drawLogo(x: number, y: number, size: number) {
    const d = this.doc;
    d.setFillColor(255, 255, 255);
    d.roundedRect(x, y, size, size, size * 0.22, size * 0.22, 'F');
    d.setFillColor(...EMERALD);
    d.roundedRect(x + 0.5, y + 0.5, size - 1, size - 1, size * 0.2, size * 0.2, 'F');
    d.setTextColor(255, 255, 255);
    d.setFont('helvetica', 'bold');
    d.setFontSize(size * 0.55);
    d.text('CC', x + size / 2, y + size * 0.68, { align: 'center' });
  }

  private geoBackground() {
    const d = this.doc;
    const w = this.pageW, h = this.pageH;
    // Soft geometric background
    d.setFillColor(...NAVY);
    d.rect(0, 0, w, h, 'F');
    // subtle accent shapes
    d.setFillColor(13, 150, 104);
    (d as any).setGState?.(new (d as any).GState({ opacity: 0.08 }));
    d.circle(w - 20, 40, 60, 'F');
    d.circle(30, h - 50, 90, 'F');
    d.setFillColor(184, 134, 11);
    (d as any).setGState?.(new (d as any).GState({ opacity: 0.06 }));
    d.triangle(0, h * 0.55, w * 0.35, h * 0.7, 0, h * 0.9, 'F');
    (d as any).setGState?.(new (d as any).GState({ opacity: 1 }));
  }

  drawWatermark() {
    const wm = this.meta.watermark;
    if (!wm) return;
    const d = this.doc;
    (d as any).setGState?.(new (d as any).GState({ opacity: 0.06 }));
    d.setTextColor(...NAVY);
    d.setFont('helvetica', 'bold');
    d.setFontSize(90);
    d.text(wm, this.pageW / 2, this.pageH / 2, {
      align: 'center', baseline: 'middle', angle: -30,
    });
    (d as any).setGState?.(new (d as any).GState({ opacity: 1 }));
  }

  // ---------- Header (compact on inner pages) ----------
  drawInnerHeader(sectionTitle: string) {
    const d = this.doc;
    d.setFillColor(...NAVY);
    d.rect(0, 0, this.pageW, 16, 'F');
    this.drawLogo(8, 3, 10);
    d.setTextColor(255, 255, 255);
    d.setFont('helvetica', 'bold'); d.setFontSize(10);
    d.text('CungaCash', 22, 9);
    d.setFont('helvetica', 'normal'); d.setFontSize(7);
    d.text('Enterprise Financial Management', 22, 13);
    d.setFont('helvetica', 'bold'); d.setFontSize(9);
    d.text(sectionTitle, this.pageW - 8, 9, { align: 'right' });
    d.setFont('helvetica', 'normal'); d.setFontSize(6.5);
    d.text(`Report ${this.meta.reportId}  ·  ${this.meta.confidentiality}`,
      this.pageW - 8, 13, { align: 'right' });
    // gold divider
    d.setDrawColor(...GOLD); d.setLineWidth(0.4);
    d.line(0, 16, this.pageW, 16);
  }

  addFooters() {
    const d = this.doc;
    const total = d.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      d.setPage(i);
      const y = this.pageH - 10;
      d.setDrawColor(...GOLD); d.setLineWidth(0.3);
      d.line(10, y - 4, this.pageW - 10, y - 4);
      d.setFont('helvetica', 'normal'); d.setFontSize(6.5); d.setTextColor(...MUTED);
      d.text('Generated by CungaCash™  ·  Enterprise Financial Management Platform', 10, y);
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold');
      d.text(this.meta.confidentiality, this.pageW / 2, y, { align: 'center' });
      d.setTextColor(...MUTED); d.setFont('helvetica', 'normal');
      d.text(`Page ${i} of ${total}`, this.pageW - 10, y, { align: 'right' });
      // second line
      d.setFontSize(5.8);
      d.text(
        `${this.meta.supportEmail ?? 'support@cungacash.com'}  ·  ${this.meta.website ?? 'www.cungacash.com'}  ·  Hash ${this.documentHash.slice(0, 12).toUpperCase()}`,
        this.pageW / 2, y + 3.5, { align: 'center' },
      );
    }
  }

  // ---------- 1. Cover Page ----------
  coverPage() {
    const d = this.doc;
    this.geoBackground();
    // Center logo & title
    this.drawLogo(this.pageW / 2 - 15, 45, 30);
    d.setTextColor(255, 255, 255);
    d.setFont('helvetica', 'bold'); d.setFontSize(30);
    d.text('CungaCash™', this.pageW / 2, 90, { align: 'center' });
    d.setFont('helvetica', 'normal'); d.setFontSize(11);
    d.setTextColor(200, 220, 210);
    d.text('Enterprise Financial Management System', this.pageW / 2, 98, { align: 'center' });

    // Gold rule
    d.setDrawColor(...GOLD); d.setLineWidth(0.6);
    d.line(this.pageW / 2 - 25, 104, this.pageW / 2 + 25, 104);

    // Report title band
    d.setFillColor(255, 255, 255);
    (d as any).setGState?.(new (d as any).GState({ opacity: 0.06 }));
    d.roundedRect(20, 118, this.pageW - 40, 90, 4, 4, 'F');
    (d as any).setGState?.(new (d as any).GState({ opacity: 1 }));

    d.setTextColor(...GOLD); d.setFont('helvetica', 'bold'); d.setFontSize(9);
    d.text('FINANCIAL REPORT', this.pageW / 2, 128, { align: 'center' });
    d.setTextColor(255, 255, 255); d.setFontSize(20);
    d.text(this.meta.reportType, this.pageW / 2, 138, { align: 'center' });

    // Info grid
    const rows: [string, string][] = [
      ['Company', this.meta.company],
      ['Period', `${format(this.meta.periodFrom, 'dd MMM yyyy')} – ${format(this.meta.periodTo, 'dd MMM yyyy')}`],
      ['Currency', this.meta.currency],
      ['Generated By', this.meta.generatedBy],
      ['Generated On', format(new Date(), 'dd MMMM yyyy · HH:mm')],
      ['Report ID', this.meta.reportId],
      ['Confidentiality', this.meta.confidentiality],
    ];
    d.setFontSize(9);
    let ry = 152;
    rows.forEach((r) => {
      d.setTextColor(...GOLD); d.setFont('helvetica', 'bold');
      d.text(r[0], 30, ry);
      d.setTextColor(255, 255, 255); d.setFont('helvetica', 'normal');
      d.text(': ' + r[1], 62, ry);
      ry += 6.5;
    });

    // Verification band
    d.setFillColor(255, 255, 255);
    (d as any).setGState?.(new (d as any).GState({ opacity: 0.08 }));
    d.roundedRect(20, 222, this.pageW - 40, 40, 3, 3, 'F');
    (d as any).setGState?.(new (d as any).GState({ opacity: 1 }));

    if (this.qrDataUrl) {
      d.addImage(this.qrDataUrl, 'PNG', 26, 226, 32, 32);
    }
    d.setTextColor(...GOLD); d.setFont('helvetica', 'bold'); d.setFontSize(8);
    d.text('QR VERIFICATION', 62, 232);
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'normal'); d.setFontSize(7);
    d.text('Scan to validate authenticity on cungacash.com/verify', 62, 237);
    d.setTextColor(...GOLD); d.setFont('helvetica', 'bold');
    d.text('DIGITAL SIGNATURE', 62, 244);
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'normal');
    d.text(`${this.meta.generatedBy} · ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 62, 249);
    d.setTextColor(...GOLD); d.setFont('helvetica', 'bold');
    d.text('DOCUMENT HASH', 62, 255);
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'normal'); d.setFontSize(6);
    d.text(this.documentHash.toUpperCase(), 62, 259, { maxWidth: this.pageW - 90 });

    // Bottom brand
    d.setTextColor(200, 210, 220); d.setFontSize(7);
    d.text('© CungaCash · rossets.rw · info@rossets.rw', this.pageW / 2, this.pageH - 12, { align: 'center' });

    this.toc.push({ title: 'Cover Page', page: this.doc.getNumberOfPages() });
  }

  // ---------- 2. Confidentiality Notice ----------
  confidentialityNotice() {
    this.doc.addPage();
    this.drawInnerHeader('Confidentiality Notice');
    this.drawWatermark();
    const d = this.doc;
    let y = 30;
    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(16);
    d.text('Confidentiality Notice', 14, y);
    y += 3; d.setDrawColor(...GOLD); d.setLineWidth(0.4); d.line(14, y, 60, y);
    y += 10;

    d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(10);
    const paras = [
      `This document contains proprietary and confidential financial information belonging to ${this.meta.company}. It is intended exclusively for the named recipients and authorised representatives.`,
      'Any unauthorised review, use, disclosure, distribution, copying or reliance on this document, or on any information it contains, is strictly prohibited.',
      'If you have received this document in error, please notify the issuing officer immediately and destroy all physical and electronic copies. Continued possession or distribution may constitute a breach of confidentiality obligations and applicable data protection laws.',
      `Document authenticity can be verified using the QR code and SHA-256 hash printed on the cover page and metadata section. Report ID: ${this.meta.reportId}.`,
    ];
    paras.forEach((p) => {
      const lines = d.splitTextToSize(p, this.pageW - 28);
      d.text(lines, 14, y);
      y += lines.length * 5.5 + 3;
    });

    // Callout
    d.setFillColor(...LIGHT); d.setDrawColor(...GOLD); d.setLineWidth(0.4);
    d.roundedRect(14, y, this.pageW - 28, 24, 2, 2, 'FD');
    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(9);
    d.text('Tamper Detection Notice', 20, y + 7);
    d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(...CHARCOAL);
    d.text('If any character of the document hash below fails to match the value on file, this document has been altered and must not be relied upon.', 20, y + 12, { maxWidth: this.pageW - 40 });
    d.setFont('courier', 'normal'); d.setFontSize(7); d.setTextColor(...NAVY);
    d.text(this.documentHash.toUpperCase(), 20, y + 21, { maxWidth: this.pageW - 40 });

    this.toc.push({ title: 'Confidentiality Notice', page: this.doc.getNumberOfPages() });
  }

  // ---------- 3. Table of Contents (placeholder — filled at end) ----------
  private tocPageNumber = 0;
  tocPagePlaceholder() {
    this.doc.addPage();
    this.tocPageNumber = this.doc.getNumberOfPages();
    this.drawInnerHeader('Table of Contents');
    this.drawWatermark();
    // record its own entry
    this.toc.push({ title: 'Table of Contents', page: this.tocPageNumber });
  }
  private renderToc() {
    if (!this.tocPageNumber) return;
    this.doc.setPage(this.tocPageNumber);
    const d = this.doc;
    let y = 30;
    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(16);
    d.text('Table of Contents', 14, y);
    y += 3; d.setDrawColor(...GOLD); d.setLineWidth(0.4); d.line(14, y, 60, y);
    y += 10;
    d.setFontSize(10);
    this.toc.forEach((t, i) => {
      d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal');
      const label = `${String(i + 1).padStart(2, '0')}   ${t.title}`;
      d.text(label, 14, y);
      // dot leader
      const labelW = d.getTextWidth(label);
      d.setTextColor(...MUTED);
      const dots = '.'.repeat(Math.max(0, Math.floor((this.pageW - 40 - labelW) / 1.6)));
      d.text(dots, 16 + labelW, y);
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold');
      d.text(String(t.page), this.pageW - 14, y, { align: 'right' });
      y += 7;
    });
  }

  // ---------- Generic section opener ----------
  beginSection(title: string) {
    this.doc.addPage();
    this.drawInnerHeader(title);
    this.drawWatermark();
    this.toc.push({ title, page: this.doc.getNumberOfPages() });
    const d = this.doc;
    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(15);
    d.text(title, 14, 28);
    d.setDrawColor(...GOLD); d.setLineWidth(0.4);
    d.line(14, 31, 44, 31);
    return 40; // starting y
  }

  ensureSpace(y: number, needed: number, sectionTitle: string) {
    if (y + needed > this.pageH - 18) {
      this.doc.addPage();
      this.drawInnerHeader(sectionTitle);
      this.drawWatermark();
      return 24;
    }
    return y;
  }

  // ---------- KPI dashboard cards ----------
  drawKpiCards(
    y: number,
    cards: { label: string; value: string; sub?: string; color?: [number, number, number] }[],
  ) {
    const d = this.doc;
    const gap = 5;
    const perRow = Math.min(4, cards.length);
    const cardW = (this.pageW - 28 - gap * (perRow - 1)) / perRow;
    const cardH = 26;
    cards.forEach((c, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = 14 + col * (cardW + gap);
      const yy = y + row * (cardH + gap);
      d.setFillColor(255, 255, 255); d.setDrawColor(...LIGHT); d.setLineWidth(0.3);
      d.roundedRect(x, yy, cardW, cardH, 2.5, 2.5, 'FD');
      // accent left bar
      d.setFillColor(...(c.color ?? EMERALD));
      d.roundedRect(x, yy, 1.5, cardH, 0.5, 0.5, 'F');
      d.setTextColor(...MUTED); d.setFont('helvetica', 'normal'); d.setFontSize(7);
      d.text(c.label.toUpperCase(), x + 5, yy + 6);
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(13);
      d.text(c.value, x + 5, yy + 15);
      if (c.sub) {
        d.setTextColor(...MUTED); d.setFont('helvetica', 'normal'); d.setFontSize(6.5);
        d.text(c.sub, x + 5, yy + 21);
      }
    });
    const rows = Math.ceil(cards.length / perRow);
    return y + rows * (cardH + gap);
  }

  // ---------- Notes/Approval/QR/Metadata sections ----------
  notesSection(notes: {
    policies?: string;
    important?: string;
    management?: string;
    auditor?: string;
  }) {
    let y = this.beginSection('Notes & Comments');
    const d = this.doc;
    const blocks: [string, string][] = [
      ['Accounting Policies', notes.policies ?? 'Financial data has been prepared on an accrual basis following generally accepted accounting principles applied consistently across the reporting period. All monetary values are expressed in ' + this.meta.currency + '. Categorisation reflects the internal chart of accounts maintained within the CungaCash platform.'],
      ['Important Notes', notes.important ?? 'All figures are derived directly from transactions recorded within the CungaCash platform for the period stated. Rounding differences of less than one currency unit may occur in aggregate views. Reversals, corrections and adjustments are included where posted before the report generation timestamp.'],
      ['Management Comments', notes.management ?? 'Management has reviewed the underlying transactions and confirms that the report fairly reflects the entity\'s income, expenses and financial position for the period. Variances against prior periods, where material, are addressed in the executive summary.'],
      ['External Auditor Notes', notes.auditor ?? 'Reserved for external audit commentary. No independent audit opinion is expressed on this document unless issued separately by a qualified auditor and appended hereto.'],
    ];
    blocks.forEach(([title, body]) => {
      y = this.ensureSpace(y, 30, 'Notes & Comments');
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(11);
      d.text(title, 14, y); y += 2;
      d.setDrawColor(...GOLD); d.setLineWidth(0.3);
      d.line(14, y, 30, y); y += 5;
      d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(9);
      const lines = d.splitTextToSize(body, this.pageW - 28);
      d.text(lines, 14, y);
      y += lines.length * 5 + 6;
    });
  }

  approvalPage() {
    let y = this.beginSection('Approval & Signatures');
    const d = this.doc;
    d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(9);
    d.text('The undersigned parties confirm that they have reviewed this report and, to the best of their knowledge, its contents accurately reflect the financial data recorded for the stated period.',
      14, y, { maxWidth: this.pageW - 28 });
    y += 18;

    const roles = [
      ['Prepared By', this.meta.generatedBy],
      ['Verified By', ''],
      ['Approved By', ''],
      ['CEO Signature', ''],
      ['Finance Director', ''],
      ['Company Stamp', ''],
    ];
    const colW = (this.pageW - 28 - 6) / 2;
    roles.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 14 + col * (colW + 6);
      const yy = y + row * 40;
      d.setDrawColor(...LIGHT); d.setLineWidth(0.3);
      d.roundedRect(x, yy, colW, 34, 2, 2, 'S');
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(9);
      d.text(r[0], x + 4, yy + 6);
      // signature line
      d.setDrawColor(...MUTED); d.setLineWidth(0.2);
      d.line(x + 4, yy + 24, x + colW - 4, yy + 24);
      d.setTextColor(...MUTED); d.setFont('helvetica', 'normal'); d.setFontSize(7);
      d.text('Signature', x + 4, yy + 28);
      d.text('Date', x + colW / 2, yy + 28);
      if (r[1]) {
        d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'italic'); d.setFontSize(10);
        d.text(r[1], x + 4, yy + 22);
      }
    });
  }

  qrVerificationPage() {
    let y = this.beginSection('QR Verification');
    const d = this.doc;
    if (this.qrDataUrl) {
      d.addImage(this.qrDataUrl, 'PNG', 14, y, 55, 55);
    }
    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(11);
    d.text('Scan to verify authenticity', 76, y + 8);
    d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(9);
    const desc = 'The QR code encodes a verification URL bound to this report ID and the first bytes of its SHA-256 hash. Scanning validates that the printed hash matches the one recorded on the CungaCash platform.';
    d.text(d.splitTextToSize(desc, this.pageW - 90), 76, y + 15);

    y += 62;
    // Hash + signature block
    d.setFillColor(...LIGHT); d.setDrawColor(...GOLD); d.setLineWidth(0.3);
    d.roundedRect(14, y, this.pageW - 28, 40, 2, 2, 'FD');
    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(9);
    d.text('SHA-256 Document Hash', 18, y + 7);
    d.setFont('courier', 'normal'); d.setFontSize(8); d.setTextColor(...CHARCOAL);
    d.text(this.documentHash.toUpperCase(), 18, y + 13, { maxWidth: this.pageW - 36 });
    d.setFont('helvetica', 'bold'); d.setTextColor(...NAVY); d.setFontSize(9);
    d.text('Digital Signature', 18, y + 25);
    d.setFont('helvetica', 'normal'); d.setTextColor(...CHARCOAL); d.setFontSize(9);
    d.text(`${this.meta.generatedBy} · ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} · Report ${this.meta.reportId}`, 18, y + 31, { maxWidth: this.pageW - 36 });
  }

  metadataPage() {
    let y = this.beginSection('Report Metadata');
    const d = this.doc;
    const rows: [string, string][] = [
      ['Report ID', this.meta.reportId],
      ['Report Type', this.meta.reportType],
      ['Company', this.meta.company],
      ['Period', `${format(this.meta.periodFrom, 'yyyy-MM-dd')} → ${format(this.meta.periodTo, 'yyyy-MM-dd')}`],
      ['Currency', this.meta.currency],
      ['Confidentiality', this.meta.confidentiality],
      ['Version', this.meta.version],
      ['Revision', String(this.meta.revision)],
      ['Audit Trail ID', this.meta.auditTrailId],
      ['Generated By', `${this.meta.generatedBy}${this.meta.generatedByEmail ? ' · ' + this.meta.generatedByEmail : ''}`],
      ['User ID', this.meta.userId],
      ['Device / Client', this.meta.deviceName],
      ['Print Timestamp', format(new Date(), 'yyyy-MM-dd HH:mm:ss xxx')],
      ['Generation Timestamp', format(new Date(), 'yyyy-MM-dd HH:mm:ss xxx')],
      ['Document Hash (SHA-256)', this.documentHash.toUpperCase()],
    ];
    d.setFontSize(9);
    rows.forEach((r) => {
      y = this.ensureSpace(y, 8, 'Report Metadata');
      d.setTextColor(...MUTED); d.setFont('helvetica', 'bold'); d.setFontSize(8);
      d.text(r[0].toUpperCase(), 14, y);
      d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(9);
      const lines = d.splitTextToSize(r[1], this.pageW - 70);
      d.text(lines, 60, y);
      y += Math.max(6, lines.length * 5) + 1;
    });
  }

  finalize() {
    this.renderToc();
    this.addFooters();
  }

  save(filename: string) {
    this.finalize();
    this.doc.save(filename);
  }
}

// --- helpers ---
export function makeReportId(kind: string) {
  const yr = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `CC-${kind.toUpperCase()}-${yr}-${rand}`;
}

export function detectDevice(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'server';
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const os = /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X/i.test(ua) ? 'macOS'
    : /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Unknown';
  const browser = /Chrome/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : /Firefox/i.test(ua) ? 'Firefox'
    : 'Browser';
  return `${browser} on ${os}${isMobile ? ' (Mobile)' : ''}`;
}

export function newAuditTrailId() {
  return 'AT-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
}
