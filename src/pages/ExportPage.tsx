import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, differenceInDays, subDays, startOfYear } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileDown, FileText, BarChart3, PiggyBank, HandCoins, FileSpreadsheet, Wallet, Trophy, Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTransactions, useDailySummaries } from '@/hooks/useTransactions';
import { useAuth } from '@/hooks/useAuth';
import { useMyTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  EnterpriseReport, makeReportId, detectDevice, newAuditTrailId,
  NAVY, EMERALD, GOLD, CHARCOAL, MUTED, LIGHT, EXPENSE as R_EXPENSE,
} from '@/lib/enterpriseReport';

const PRIMARY = EMERALD;
const EXPENSE = R_EXPENSE;
const INK = CHARCOAL;

// 12-color palette for chart slices
const PALETTE: [number, number, number][] = [
  EMERALD, R_EXPENSE, [37, 99, 235], GOLD,
  [139, 92, 246], [14, 165, 233], [236, 72, 153], [5, 150, 105],
  [202, 138, 4], [124, 58, 237], [219, 39, 119], [2, 132, 199],
];

export default function ExportPage() {
  const { user } = useAuth();
  const { info: tenant } = useMyTenant();
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));
  const [preset, setPreset] = useState<string>('mtd');
  const [busy, setBusy] = useState<string | null>(null);
  const [exportState, setExportState] = useState<Record<string, 'loading' | 'done' | 'error'>>({});
  const [exportError, setExportError] = useState<Record<string, string>>({});

  const run = (id: string, fn: () => any) => async () => {
    setExportState(s => ({ ...s, [id]: 'loading' }));
    setExportError(e => ({ ...e, [id]: '' }));
    try {
      await fn();
      setExportState(s => ({ ...s, [id]: 'done' }));
      setTimeout(() => setExportState(s => ({ ...s, [id]: undefined as any })), 3000);
    } catch (err: any) {
      setExportState(s => ({ ...s, [id]: 'error' }));
      setExportError(e => ({ ...e, [id]: err?.message ?? 'Export failed' }));
    }
  };


  const fromStr = format(from, 'yyyy-MM-dd');
  const toStr = format(to, 'yyyy-MM-dd');

  // e.g. "last-7-days_2026-06-29_to_2026-07-06" or "custom_..._to_..."
  const rangeSlug = () => `${preset || 'custom'}_${fromStr}_to_${toStr}`;
  const outName = (kind: string, ext: 'pdf' | 'xlsx') => `cungacash-${kind}_${rangeSlug()}.${ext}`;

  const { data: transactions, isLoading: txLoading } = useTransactions({ from: fromStr, to: toStr });
  const { data: summaries, isLoading: sumLoading } = useDailySummaries(fromStr, toStr);

  const totals = useMemo(() => {
    if (!transactions) return { income: 0, expense: 0, net: 0 };
    let income = 0, expense = 0;
    for (const tx of transactions) {
      if (tx.type === 'INCOME') income += tx.total_amount ?? 0;
      else expense += tx.total_amount ?? 0;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  const fmt = (n: number) => Number(n).toLocaleString('en-RW', { maximumFractionDigits: 0 });

  // ---------- Chart primitives (accept a jsPDF instance) ----------
  const drawPie = (
    doc: jsPDF, cx: number, cy: number, r: number,
    slices: { label: string; value: number; color: [number, number, number] }[]
  ) => {
    const total = slices.reduce((s, x) => s + x.value, 0);
    if (total <= 0) {
      doc.setDrawColor(...MUTED); doc.setFillColor(...LIGHT);
      doc.circle(cx, cy, r, 'F');
      return;
    }
    let startAngle = -Math.PI / 2;
    const STEP = Math.PI / 90;
    for (const s of slices) {
      if (s.value <= 0) continue;
      const sweep = (s.value / total) * Math.PI * 2;
      const endAngle = startAngle + sweep;
      doc.setFillColor(...s.color);
      let prevX = cx + Math.cos(startAngle) * r;
      let prevY = cy + Math.sin(startAngle) * r;
      for (let a = startAngle + STEP; a <= endAngle + 1e-6; a += STEP) {
        const nx = cx + Math.cos(a) * r;
        const ny = cy + Math.sin(a) * r;
        doc.triangle(cx, cy, prevX, prevY, nx, ny, 'F');
        prevX = nx; prevY = ny;
      }
      startAngle = endAngle;
    }
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r * 0.5, 'F');
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(`${fmt(total)}`, cx, cy - 1, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED);
    doc.text('RWF', cx, cy + 3, { align: 'center' });
  };

  const drawLegend = (
    doc: jsPDF, x: number, y: number, maxW: number,
    items: { label: string; value: number; color: [number, number, number] }[],
    total: number,
  ) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    let cy = y;
    items.forEach((it) => {
      doc.setFillColor(...it.color);
      doc.roundedRect(x, cy - 2.5, 3, 3, 0.6, 0.6, 'F');
      doc.setTextColor(...INK);
      const pct = total > 0 ? ((it.value / total) * 100).toFixed(1) : '0';
      const label = it.label.length > 22 ? it.label.slice(0, 21) + '…' : it.label;
      doc.text(label, x + 5, cy);
      doc.setTextColor(...MUTED);
      doc.text(`${pct}%  ${fmt(it.value)}`, x + maxW, cy, { align: 'right' });
      cy += 5;
    });
  };

  const drawBars = (
    doc: jsPDF, x: number, y: number, w: number, h: number,
    series: { label: string; income: number; expense: number }[],
  ) => {
    if (series.length === 0) return;
    const maxVal = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
    const padL = 14, padB = 10, padT = 4;
    const innerW = w - padL - 4;
    const innerH = h - padB - padT;
    doc.setDrawColor(...MUTED); doc.setLineWidth(0.2);
    doc.line(x + padL, y + padT, x + padL, y + padT + innerH);
    doc.line(x + padL, y + padT + innerH, x + w - 2, y + padT + innerH);
    doc.setFontSize(6); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
    for (let i = 0; i <= 3; i++) {
      const v = (maxVal / 3) * i;
      const yy = y + padT + innerH - (innerH / 3) * i;
      doc.text(fmt(v), x + padL - 1, yy + 1, { align: 'right' });
      if (i > 0) {
        doc.setDrawColor(230, 230, 230);
        doc.line(x + padL, yy, x + w - 2, yy);
        doc.setDrawColor(...MUTED);
      }
    }
    const slot = innerW / series.length;
    const barW = Math.min(8, (slot - 2) / 2);
    series.forEach((s, i) => {
      const cx = x + padL + slot * i + slot / 2;
      const ihh = (s.income / maxVal) * innerH;
      const ehh = (s.expense / maxVal) * innerH;
      doc.setFillColor(...EMERALD);
      doc.rect(cx - barW - 0.5, y + padT + innerH - ihh, barW, ihh, 'F');
      doc.setFillColor(...EXPENSE);
      doc.rect(cx + 0.5, y + padT + innerH - ehh, barW, ehh, 'F');
      doc.setTextColor(...MUTED); doc.setFontSize(6);
      doc.text(s.label, cx, y + padT + innerH + 4, { align: 'center' });
    });
    doc.setFillColor(...EMERALD); doc.rect(x + w - 36, y + 1, 2.5, 2.5, 'F');
    doc.setTextColor(...INK); doc.setFontSize(6); doc.text('Income', x + w - 32, y + 3);
    doc.setFillColor(...EXPENSE); doc.rect(x + w - 18, y + 1, 2.5, 2.5, 'F');
    doc.text('Expense', x + w - 14, y + 3);
  };

  // ---------- Smart insights (used in flagship report) ----------
  const computeInsights = () => {
    if (!transactions || transactions.length === 0) return [];
    const days = Math.max(1, differenceInDays(to, from) + 1);
    const expByCat: Record<string, number> = {};
    const incByCat: Record<string, number> = {};
    const dailyExp: Record<string, number> = {};
    transactions.forEach((tx) => {
      const amt = tx.total_amount ?? 0;
      if (tx.type === 'EXPENSE') {
        expByCat[tx.category] = (expByCat[tx.category] ?? 0) + amt;
        dailyExp[tx.transaction_date] = (dailyExp[tx.transaction_date] ?? 0) + amt;
      } else {
        incByCat[tx.category] = (incByCat[tx.category] ?? 0) + amt;
      }
    });
    const out: string[] = [];
    const savingRate = totals.income > 0 ? (totals.net / totals.income) * 100 : 0;
    if (totals.income > 0) {
      if (savingRate >= 20) out.push(`Strong savings rate of ${savingRate.toFixed(1)}% — you kept ${fmt(totals.net)} RWF of every income earned.`);
      else if (savingRate >= 0) out.push(`Modest savings rate of ${savingRate.toFixed(1)}%. Aim for 20%+ to build a healthy buffer.`);
      else out.push(`You spent ${(-savingRate).toFixed(1)}% more than you earned — net deficit of ${fmt(-totals.net)} RWF.`);
    }
    out.push(`Average daily spending: ${fmt(totals.expense / days)} RWF over ${days} day${days > 1 ? 's' : ''}.`);
    const topExp = Object.entries(expByCat).sort((a, b) => b[1] - a[1])[0];
    if (topExp && totals.expense > 0) {
      const pct = (topExp[1] / totals.expense) * 100;
      out.push(`Largest expense category: "${topExp[0]}" at ${fmt(topExp[1])} RWF (${pct.toFixed(1)}% of spending).`);
    }
    const topInc = Object.entries(incByCat).sort((a, b) => b[1] - a[1])[0];
    if (topInc && totals.income > 0) {
      const pct = (topInc[1] / totals.income) * 100;
      out.push(`Top income source: "${topInc[0]}" contributing ${pct.toFixed(1)}% of total income.`);
    }
    const peak = Object.entries(dailyExp).sort((a, b) => b[1] - a[1])[0];
    if (peak) out.push(`Peak spending day: ${format(new Date(peak[0]), 'MMM d, yyyy')} with ${fmt(peak[1])} RWF.`);
    out.push(`${transactions.length} transaction${transactions.length > 1 ? 's' : ''} recorded across ${Object.keys(expByCat).length + Object.keys(incByCat).length} categories.`);
    return out;
  };

  // ---------- Profile / meta ----------
  const getProfile = async (): Promise<{ name: string; email: string }> => {
    if (!user) return { name: '—', email: '' };
    const { data } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
    const fallback = user.email?.split('@')[0] ?? 'User';
    return { name: data?.full_name?.trim() || fallback, email: user.email ?? '' };
  };

  const buildMeta = async (reportType: string, kindCode: string) => {
    const profile = await getProfile();
    return {
      reportType,
      // Personal report: the document belongs to the person, not a company.
      company: profile.name || 'CungaCash User',
      periodFrom: from,
      periodTo: to,
      currency: 'RWF',
      generatedBy: profile.name,
      generatedByEmail: profile.email,
      reportId: makeReportId(kindCode),
      confidentiality: 'FINAL' as const,
      version: '1.0',
      revision: 0,
      auditTrailId: newAuditTrailId(),
      deviceName: detectDevice(),
      userId: user?.id ?? '—',
      watermark: null,
      supportEmail: 'support@cungacash.com',
      website: 'www.cungacash.com',
    };
  };

  /** Build scaffold: cover + TOC placeholder (personal, professional — no corporate notices). */
  const openReport = async (reportType: string, kindCode: string) => {
    const meta = await buildMeta(reportType, kindCode);
    const report = new EnterpriseReport(meta);
    // Hash payload accumulator — content signature
    report.addToHash(`${totals.income}|${totals.expense}|${totals.net}|${transactions?.length ?? 0}`);
    await report.computeHash();
    await report.buildQr();
    report.coverPage();
    report.tocPagePlaceholder();
    return report;
  };

  const closeReport = (report: EnterpriseReport, extraNotes: Parameters<EnterpriseReport['notesSection']>[0] = {}) => {
    report.notesSection(extraNotes);
    report.qrVerificationPage();
    report.metadataPage();
    return report;
  };


  // ---------- KPI helpers ----------
  const kpiRow = (extra: { label: string; value: string; sub?: string; color?: [number,number,number] }[] = []) => [
    { label: 'Total Income', value: `${fmt(totals.income)} RWF`, sub: 'Cash inflows in period', color: EMERALD },
    { label: 'Total Expense', value: `${fmt(totals.expense)} RWF`, sub: 'Cash outflows in period', color: EXPENSE },
    { label: 'Net Balance', value: `${fmt(totals.net)} RWF`, sub: totals.net >= 0 ? 'Surplus' : 'Deficit', color: totals.net >= 0 ? EMERALD : EXPENSE },
    { label: 'Transactions', value: `${transactions?.length ?? 0}`, sub: 'Records processed', color: NAVY },
    ...extra,
  ];

  // ---------- Comparative (prior period same length) ----------
  const fetchPriorTotals = async () => {
    if (!user) return { income: 0, expense: 0 };
    const days = differenceInDays(to, from) + 1;
    const priorTo = subDays(from, 1);
    const priorFrom = subDays(priorTo, days - 1);
    const { data } = await supabase
      .from('transactions')
      .select('type,total_amount')
      .eq('user_id', user.id)
      .gte('transaction_date', format(priorFrom, 'yyyy-MM-dd'))
      .lte('transaction_date', format(priorTo, 'yyyy-MM-dd'));
    let inc = 0, exp = 0;
    (data ?? []).forEach((r: any) => {
      if (r.type === 'INCOME') inc += Number(r.total_amount ?? 0);
      else exp += Number(r.total_amount ?? 0);
    });
    return { income: inc, expense: exp, from: priorFrom, to: priorTo };
  };

  // ---------- FLAGSHIP: Smart Summary (full enterprise structure) ----------
  const exportMonthlySummaryPDF = async () => {
    if (!transactions || transactions.length === 0) { toast.error('No data to export'); return; }
    const report = await openReport('Financial Summary & Analysis', 'FS');
    const d = report.doc;

    // 4. Executive Summary
    let y = report.beginSection('Executive Summary');
    d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(10);
    const days = differenceInDays(to, from) + 1;
    const savingsRate = totals.income > 0 ? (totals.net / totals.income) * 100 : 0;
    const summary = `This report presents the personal financial activity of ${report.meta.company} for the period ${format(from, 'dd MMM yyyy')} through ${format(to, 'dd MMM yyyy')} (${days} day${days > 1 ? 's' : ''}). During this window a total of ${transactions.length} financial transaction${transactions.length > 1 ? 's were' : ' was'} recorded, aggregating ${fmt(totals.income)} RWF in income and ${fmt(totals.expense)} RWF in expenses, resulting in a net ${totals.net >= 0 ? 'surplus' : 'deficit'} of ${fmt(Math.abs(totals.net))} RWF and an effective savings rate of ${savingsRate.toFixed(1)}%.`;
    d.text(d.splitTextToSize(summary, report.pageW - 28), 14, y);
    y += Math.ceil(summary.length / 90) * 5 + 10;

    // 5. KPI Dashboard
    y = report.beginSection('KPI Dashboard');
    report.drawKpiCards(y, kpiRow());

    // 6. Charts & Graphs
    y = report.beginSection('Charts & Graphs');
    const expenseMap: Record<string, number> = {};
    const incomeMap: Record<string, number> = {};
    const paymentMap: Record<string, number> = {};
    transactions.forEach((tx) => {
      const amt = tx.total_amount ?? 0;
      if (tx.type === 'EXPENSE') expenseMap[tx.category] = (expenseMap[tx.category] ?? 0) + amt;
      else incomeMap[tx.category] = (incomeMap[tx.category] ?? 0) + amt;
      if (tx.payment_method) paymentMap[tx.payment_method] = (paymentMap[tx.payment_method] ?? 0) + amt;
    });
    const expSlices = Object.entries(expenseMap).sort((a, b) => b[1] - a[1])
      .slice(0, 8).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
    const incSlices = Object.entries(incomeMap).sort((a, b) => b[1] - a[1])
      .slice(0, 8).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(10);
    d.text('Expense Breakdown', 14, y);
    d.text('Income Breakdown', report.pageW / 2 + 4, y);
    y += 4;
    drawPie(d, 36, y + 24, 22, expSlices);
    drawLegend(d, 62, y + 6, 28, expSlices, totals.expense);
    drawPie(d, report.pageW / 2 + 26, y + 24, 22, incSlices);
    drawLegend(d, report.pageW / 2 + 52, y + 6, 28, incSlices, totals.income);
    y += 60;

    if (summaries && summaries.length > 0) {
      const recent = summaries.slice(-14).map((s) => ({
        label: format(new Date(s.summary_date), 'd/M'),
        income: Number(s.total_income ?? 0),
        expense: Number(s.total_expense ?? 0),
      }));
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(10);
      d.text('Daily Income vs Expense (last 14 days)', 14, y);
      drawBars(d, 14, y + 2, report.pageW - 28, 55, recent);
    }

    // 7. Main Financial Report
    y = report.beginSection('Main Financial Report');
    const expenseRows = Object.entries(expenseMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [
      cat, `${fmt(amt)} RWF`, `${totals.expense > 0 ? ((amt / totals.expense) * 100).toFixed(1) : 0}%`,
    ]);
    autoTable(d, {
      startY: y,
      head: [['Expense Category', 'Amount', '% of Total']],
      body: expenseRows,
      headStyles: { fillColor: NAVY, fontSize: 9, fontStyle: 'bold', textColor: [255,255,255] },
      bodyStyles: { fontSize: 9, textColor: CHARCOAL },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220, 226, 232] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
    });
    y = (d as any).lastAutoTable.finalY + 6;
    if (Object.keys(incomeMap).length > 0) {
      autoTable(d, {
        startY: y,
        head: [['Income Category', 'Amount', '% of Total']],
        body: Object.entries(incomeMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [
          cat, `${fmt(amt)} RWF`, `${totals.income > 0 ? ((amt / totals.income) * 100).toFixed(1) : 0}%`,
        ]),
        headStyles: { fillColor: EMERALD, fontSize: 9, fontStyle: 'bold', textColor: [255,255,255] },
        bodyStyles: { fontSize: 9, textColor: CHARCOAL },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220, 226, 232] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
      });
    }

    // 8. Comparative Analysis
    const prior = await fetchPriorTotals();
    y = report.beginSection('Comparative Analysis');
    const pctChange = (curr: number, prev: number) => {
      if (prev === 0) return curr === 0 ? '0%' : '+∞';
      const p = ((curr - prev) / prev) * 100;
      return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
    };
    autoTable(d, {
      startY: y,
      head: [['Metric', 'Current Period', 'Prior Period', 'Change']],
      body: [
        ['Income', `${fmt(totals.income)} RWF`, `${fmt(prior.income)} RWF`, pctChange(totals.income, prior.income)],
        ['Expense', `${fmt(totals.expense)} RWF`, `${fmt(prior.expense)} RWF`, pctChange(totals.expense, prior.expense)],
        ['Net Balance', `${fmt(totals.net)} RWF`, `${fmt(prior.income - prior.expense)} RWF`, pctChange(totals.net, prior.income - prior.expense)],
      ],
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: CHARCOAL },
      styles: { cellPadding: 4, lineWidth: 0.1, lineColor: [220,226,232] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center', fontStyle: 'bold' } },
    });

    // 9. AI Insights
    y = report.beginSection('AI Insights');
    const insights = computeInsights();
    d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(10);
    insights.forEach((t) => {
      y = report.ensureSpace(y, 12, 'AI Insights');
      d.setFillColor(...LIGHT);
      d.roundedRect(14, y - 4, report.pageW - 28, 10, 1.5, 1.5, 'F');
      d.setTextColor(...EMERALD); d.setFont('helvetica', 'bold');
      d.text('▸', 18, y + 2);
      d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal');
      d.text(t, 24, y + 2, { maxWidth: report.pageW - 44 });
      y += 12;
    });

    // 10. Risk Assessment
    y = report.beginSection('Risk Assessment');
    const risks: [string, string, string][] = [];
    if (savingsRate < 0) risks.push(['Cash flow deficit', 'HIGH', 'Expenses exceed income; corrective action required.']);
    else if (savingsRate < 10) risks.push(['Low savings buffer', 'MEDIUM', 'Savings rate below 10%; limited resilience to shocks.']);
    else risks.push(['Savings adequacy', 'LOW', 'Savings rate is within a healthy range.']);
    const topExpAmt = Math.max(0, ...Object.values(expenseMap));
    if (totals.expense > 0 && topExpAmt / totals.expense > 0.5)
      risks.push(['Expense concentration', 'MEDIUM', 'A single category exceeds 50% of expenses — diversify to reduce exposure.']);
    if (transactions.length < 5) risks.push(['Data sufficiency', 'MEDIUM', 'Small transaction sample may not represent typical activity.']);
    autoTable(d, {
      startY: y,
      head: [['Risk', 'Severity', 'Assessment']],
      body: risks,
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: CHARCOAL },
      styles: { cellPadding: 4, lineWidth: 0.1, lineColor: [220,226,232] },
      columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const v = String(data.cell.raw);
          data.cell.styles.textColor = v === 'HIGH' ? EXPENSE : v === 'MEDIUM' ? GOLD : EMERALD;
        }
      },
    });

    // 11. Detailed Transactions
    y = report.beginSection('Detailed Transactions');
    autoTable(d, {
      startY: y,
      head: [['Date', 'Type', 'Category', 'Description', 'Qty', 'Unit', 'Total', 'Payment']],
      body: transactions.map((tx) => [
        format(new Date(tx.transaction_date), 'yyyy-MM-dd'),
        tx.type, tx.category, tx.description || '-',
        String(tx.quantity ?? 1),
        `${fmt(tx.unit_price)}`,
        `${fmt(tx.total_amount ?? 0)}`,
        tx.payment_method || '-',
      ]),
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: CHARCOAL },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 2.5, lineWidth: 0.1, lineColor: [220,226,232] },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'INCOME' ? EMERALD : EXPENSE;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: () => {
        report.drawInnerHeader('Detailed Transactions');
        report.drawWatermark();
      },
      margin: { top: 22, bottom: 18 },
    });

    // 12. Supporting Schedules (payment methods)
    if (Object.keys(paymentMap).length > 0) {
      y = report.beginSection('Supporting Schedules');
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(10);
      d.text('Schedule A — Payment Method Breakdown', 14, y); y += 4;
      const totalAll = totals.income + totals.expense;
      autoTable(d, {
        startY: y,
        head: [['Payment Method', 'Amount', '% of Total']],
        body: Object.entries(paymentMap).sort((a, b) => b[1] - a[1]).map(([m, a]) => [
          m, `${fmt(a)} RWF`, `${totalAll > 0 ? ((a / totalAll) * 100).toFixed(1) : 0}%`,
        ]),
        headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: CHARCOAL },
        alternateRowStyles: { fillColor: LIGHT },
        styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220,226,232] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
      });
    }

    // 16. Appendix
    y = report.beginSection('Appendix');
    d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(9);
    const glossary: [string, string][] = [
      ['Savings Rate', 'Net balance divided by total income, expressed as a percentage.'],
      ['Net Balance', 'Total income less total expenses over the stated period.'],
      ['Expense Concentration', 'Share of total expenses attributable to the largest single category.'],
      ['SHA-256', 'Cryptographic hash used to detect tampering in this document.'],
      ['Audit Trail ID', 'Unique identifier linking this report to platform audit records.'],
    ];
    glossary.forEach(([term, def]) => {
      y = report.ensureSpace(y, 10, 'Appendix');
      d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(9);
      d.text(term, 14, y);
      d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal');
      const lines = d.splitTextToSize(def, report.pageW - 60);
      d.text(lines, 55, y);
      y += Math.max(6, lines.length * 5) + 1;
    });

    // 13-15. Notes, Approval, QR verification, 17. Metadata
    closeReport(report);
    report.save(outName(`${report.meta.reportId.toLowerCase()}`, "pdf"));
    toast.success('Boardroom-quality summary downloaded');
  };

  // ---------- Transactions PDF ----------
  const exportTransactionsPDF = async () => {
    if (!transactions || transactions.length === 0) { toast.error('No transactions to export'); return; }
    const report = await openReport('Transaction Register', 'TR');
    const d = report.doc;

    let y = report.beginSection('Executive Summary');
    d.setTextColor(...CHARCOAL); d.setFont('helvetica', 'normal'); d.setFontSize(10);
    const txt = `This register lists every financial transaction recorded on the CungaCash platform for ${report.meta.company} from ${format(from, 'dd MMM yyyy')} to ${format(to, 'dd MMM yyyy')}. It is intended as an official record for review, reconciliation and audit purposes.`;
    d.text(d.splitTextToSize(txt, report.pageW - 28), 14, y);

    y = report.beginSection('KPI Dashboard');
    report.drawKpiCards(y, kpiRow());

    y = report.beginSection('Detailed Transactions');
    autoTable(d, {
      startY: y,
      head: [['Date', 'Type', 'Category', 'Description', 'Qty', 'Unit Price', 'Total', 'Payment']],
      body: transactions.map((tx) => [
        format(new Date(tx.transaction_date), 'yyyy-MM-dd'),
        tx.type, tx.category, tx.description || '-',
        String(tx.quantity ?? 1),
        `${fmt(tx.unit_price)} RWF`,
        `${fmt(tx.total_amount ?? 0)} RWF`,
        tx.payment_method || '-',
      ]),
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: CHARCOAL },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220,226,232] },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'INCOME' ? EMERALD : EXPENSE;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: () => { report.drawInnerHeader('Detailed Transactions'); report.drawWatermark(); },
      margin: { top: 22, bottom: 18 },
    });

    closeReport(report);
    report.save(outName(`${report.meta.reportId.toLowerCase()}`, "pdf"));
    toast.success('Transactions PDF downloaded');
  };

  // ---------- Daily Report PDF ----------
  const exportDailyReportPDF = async () => {
    if (!summaries || summaries.length === 0) { toast.error('No daily data to export'); return; }
    const report = await openReport('Daily Activity Statement', 'DA');
    const d = report.doc;

    let y = report.beginSection('KPI Dashboard');
    y = report.drawKpiCards(y, kpiRow());

    y = report.beginSection('Charts & Graphs');
    const recent = summaries.slice(-14).map((s) => ({
      label: format(new Date(s.summary_date), 'd/M'),
      income: Number(s.total_income ?? 0),
      expense: Number(s.total_expense ?? 0),
    }));
    d.setTextColor(...NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(10);
    d.text('Daily Income vs Expense (last 14 days)', 14, y);
    drawBars(d, 14, y + 2, report.pageW - 28, 60, recent);

    y = report.beginSection('Daily Detail');
    autoTable(d, {
      startY: y,
      head: [['Date', 'Income', 'Expense', 'Net Balance']],
      body: summaries.map((s) => [
        format(new Date(s.summary_date), 'EEE, MMM d, yyyy'),
        `${fmt(s.total_income ?? 0)} RWF`, `${fmt(s.total_expense ?? 0)} RWF`, `${fmt(s.net_balance ?? 0)} RWF`,
      ]),
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: CHARCOAL },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 4, lineWidth: 0.1, lineColor: [220,226,232] },
      columnStyles: {
        1: { halign: 'right', textColor: EMERALD },
        2: { halign: 'right', textColor: EXPENSE },
        3: { halign: 'right', fontStyle: 'bold' },
      },
      didDrawPage: () => { report.drawInnerHeader('Daily Detail'); report.drawWatermark(); },
      margin: { top: 22, bottom: 18 },
    });

    closeReport(report);
    report.save(outName(`${report.meta.reportId.toLowerCase()}`, "pdf"));
    toast.success('Daily report PDF downloaded');
  };

  // ---------- Savings / Loans data fetches ----------
  const fetchSavingsHistory = async () => {
    const [{ data: accts }, { data: txs }] = await Promise.all([
      supabase.from('savings_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('savings_transactions').select('*')
        .gte('occurred_at', `${fromStr}T00:00:00`)
        .lte('occurred_at', `${toStr}T23:59:59`)
        .order('occurred_at', { ascending: false }),
    ]);
    return { accounts: accts ?? [], txs: txs ?? [] };
  };

  const fetchLoanHistory = async () => {
    const [{ data: loans }, { data: ltxs }] = await Promise.all([
      supabase.from('loans').select('*').order('loan_date', { ascending: false }),
      supabase.from('loan_transactions').select('*')
        .gte('occurred_at', `${fromStr}T00:00:00`)
        .lte('occurred_at', `${toStr}T23:59:59`)
        .order('occurred_at', { ascending: false }),
    ]);
    return { loans: loans ?? [], ltxs: ltxs ?? [] };
  };

  // ---------- Savings PDF ----------
  const exportSavingsPDF = async () => {
    const { accounts, txs } = await fetchSavingsHistory();
    if (accounts.length === 0 && txs.length === 0) { toast.error('No savings data in this range'); return; }
    const report = await openReport('Savings Statement', 'SV');
    const d = report.doc;

    const totalBalance = accounts.reduce((s, a: any) => s + Number(a.current_balance ?? 0), 0);
    const deposits = txs.filter((t: any) => t.action === 'DEPOSIT').reduce((s, t: any) => s + Number(t.amount), 0);
    const withdrawals = txs.filter((t: any) => t.action === 'WITHDRAW').reduce((s, t: any) => s + Number(t.amount), 0);

    let y = report.beginSection('KPI Dashboard');
    report.drawKpiCards(y, [
      { label: 'Current Balance', value: `${fmt(totalBalance)} RWF`, sub: `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`, color: EMERALD },
      { label: 'Deposits', value: `${fmt(deposits)} RWF`, sub: 'Inflows in period', color: EMERALD },
      { label: 'Withdrawals', value: `${fmt(withdrawals)} RWF`, sub: 'Outflows in period', color: EXPENSE },
      { label: 'Net Change', value: `${fmt(deposits - withdrawals)} RWF`, sub: deposits - withdrawals >= 0 ? 'Growth' : 'Contraction', color: deposits - withdrawals >= 0 ? EMERALD : EXPENSE },
    ]);

    if (accounts.length > 0) {
      y = report.beginSection('Savings Accounts');
      autoTable(d, {
        startY: y,
        head: [['Account', 'Current Balance', 'Goal', 'Progress']],
        body: accounts.map((a: any) => [
          a.name,
          `${fmt(a.current_balance)} RWF`,
          a.goal_amount > 0 ? `${fmt(a.goal_amount)} RWF` : '—',
          a.goal_amount > 0 ? `${Math.min(100, ((a.current_balance / a.goal_amount) * 100)).toFixed(1)}%` : '—',
        ]),
        headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: CHARCOAL },
        alternateRowStyles: { fillColor: LIGHT },
        styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220,226,232] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center' } },
      });
    }

    if (txs.length > 0) {
      y = report.beginSection('Transaction History');
      const acctMap = new Map(accounts.map((a: any) => [a.id, a.name]));
      autoTable(d, {
        startY: y,
        head: [['Date & Time', 'Account', 'Action', 'Amount', 'Receipt #', 'Note']],
        body: txs.map((t: any) => [
          format(new Date(t.occurred_at), 'yyyy-MM-dd HH:mm'),
          acctMap.get(t.account_id) ?? '—',
          t.action, `${fmt(t.amount)} RWF`, t.receipt_no, t.note ?? '',
        ]),
        headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: CHARCOAL },
        alternateRowStyles: { fillColor: LIGHT },
        styles: { cellPadding: 2.5, lineWidth: 0.1, lineColor: [220,226,232] },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            data.cell.styles.textColor = data.cell.raw === 'DEPOSIT' ? EMERALD : EXPENSE;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawPage: () => { report.drawInnerHeader('Transaction History'); report.drawWatermark(); },
        margin: { top: 22, bottom: 18 },
      });
    }

    closeReport(report);
    report.save(outName(`${report.meta.reportId.toLowerCase()}`, "pdf"));
    toast.success('Savings PDF downloaded');
  };

  // ---------- Loans PDF ----------
  const exportLoansPDF = async () => {
    const { loans, ltxs } = await fetchLoanHistory();
    if (loans.length === 0 && ltxs.length === 0) { toast.error('No loan data in this range'); return; }
    const report = await openReport('Loans & Repayments Statement', 'LN');
    const d = report.doc;

    const oweMe = loans.filter((l: any) => l.type === 'GIVEN' && l.status === 'PENDING').reduce((s, l: any) => s + Number(l.amount), 0);
    const iOwe = loans.filter((l: any) => l.type === 'RECEIVED' && l.status === 'PENDING').reduce((s, l: any) => s + Number(l.amount), 0);
    const repaid = ltxs.filter((t: any) => t.action !== 'ADD').reduce((s, t: any) => s + Number(t.amount), 0);

    let y = report.beginSection('KPI Dashboard');
    report.drawKpiCards(y, [
      { label: 'People Owe Me', value: `${fmt(oweMe)} RWF`, sub: 'Outstanding receivables', color: EMERALD },
      { label: 'I Owe', value: `${fmt(iOwe)} RWF`, sub: 'Outstanding payables', color: EXPENSE },
      { label: 'Repayments', value: `${fmt(repaid)} RWF`, sub: 'Settled in period', color: EMERALD },
      { label: 'Active Loans', value: `${loans.length}`, sub: 'Recorded', color: NAVY },
    ]);

    if (loans.length > 0) {
      y = report.beginSection('Loan Ledger');
      autoTable(d, {
        startY: y,
        head: [['Date', 'Person', 'Type', 'Outstanding', 'Status', 'Notes']],
        body: loans.map((l: any) => [
          format(new Date(l.loan_date), 'yyyy-MM-dd'),
          l.person_name, l.type, `${fmt(l.amount)} RWF`, l.status, l.description ?? '',
        ]),
        headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, textColor: CHARCOAL },
        alternateRowStyles: { fillColor: LIGHT },
        styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220,226,232] },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (dc) => {
          if (dc.section === 'body' && dc.column.index === 2) {
            dc.cell.styles.textColor = dc.cell.raw === 'GIVEN' ? EMERALD : EXPENSE;
            dc.cell.styles.fontStyle = 'bold';
          }
          if (dc.section === 'body' && dc.column.index === 4) {
            dc.cell.styles.textColor = dc.cell.raw === 'PAID' ? EMERALD : MUTED;
          }
        },
      });
    }

    if (ltxs.length > 0) {
      y = report.beginSection('Action History');
      const loanMap = new Map(loans.map((l: any) => [l.id, l.person_name]));
      autoTable(d, {
        startY: y,
        head: [['Date & Time', 'Person', 'Action', 'Amount', 'Receipt #', 'Note']],
        body: ltxs.map((t: any) => [
          format(new Date(t.occurred_at), 'yyyy-MM-dd HH:mm'),
          loanMap.get(t.loan_id) ?? '—',
          t.action, `${fmt(t.amount)} RWF`, t.receipt_no, t.note ?? '',
        ]),
        headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, textColor: CHARCOAL },
        alternateRowStyles: { fillColor: LIGHT },
        styles: { cellPadding: 2.5, lineWidth: 0.1, lineColor: [220,226,232] },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (dc) => {
          if (dc.section === 'body' && dc.column.index === 2) {
            dc.cell.styles.textColor = dc.cell.raw === 'ADD' ? EXPENSE : EMERALD;
            dc.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawPage: () => { report.drawInnerHeader('Action History'); report.drawWatermark(); },
        margin: { top: 22, bottom: 18 },
      });
    }

    closeReport(report);
    report.save(outName(`${report.meta.reportId.toLowerCase()}`, "pdf"));
    toast.success('Loans PDF downloaded');
  };

  // ---------- Excel exports (unchanged) ----------
  const exportTransactionsXLSX = async () => {
    if (!transactions || transactions.length === 0) { toast.error('No transactions to export'); return; }
    const profile = await getProfile();
    const wb = XLSX.utils.book_new();
    const meta = [
      ['CungaCash — Transactions Report'],
      ['User', profile.name], ['Email', profile.email],
      ['Period', `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`],
      ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')],
      [], ['Total Income', totals.income], ['Total Expense', totals.expense], ['Net Balance', totals.net], [],
    ];
    const rows = [
      ['Date', 'Type', 'Category', 'Description', 'Quantity', 'Unit Price (RWF)', 'Total (RWF)', 'Payment Method'],
      ...transactions.map((t) => [
        t.transaction_date, t.type, t.category, t.description ?? '',
        t.quantity ?? 1, Number(t.unit_price), Number(t.total_amount ?? 0), t.payment_method ?? '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows]);
    ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, outName("transactions", "xlsx"));
    toast.success('Transactions Excel downloaded');
  };

  const exportSavingsXLSX = async () => {
    const profile = await getProfile();
    const { accounts, txs } = await fetchSavingsHistory();
    if (accounts.length === 0 && txs.length === 0) { toast.error('No savings data'); return; }
    const acctMap = new Map(accounts.map((a: any) => [a.id, a.name]));
    const wb = XLSX.utils.book_new();
    const meta = [
      ['CungaCash — Savings Report'], ['User', profile.name],
      ['Period', `${fromStr} – ${toStr}`], ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')], [],
    ];
    const acctRows = [['Account', 'Current Balance (RWF)', 'Goal (RWF)', 'Progress %'],
      ...accounts.map((a: any) => [a.name, Number(a.current_balance), Number(a.goal_amount ?? 0),
        a.goal_amount > 0 ? Number(((a.current_balance / a.goal_amount) * 100).toFixed(2)) : 0])];
    const txRows = [['Date', 'Account', 'Action', 'Amount (RWF)', 'Receipt #', 'Note'],
      ...txs.map((t: any) => [
        format(new Date(t.occurred_at), 'yyyy-MM-dd HH:mm'),
        acctMap.get(t.account_id) ?? '—', t.action, Number(t.amount), t.receipt_no, t.note ?? '',
      ])];
    const wsA = XLSX.utils.aoa_to_sheet([...meta, ...acctRows]);
    const wsT = XLSX.utils.aoa_to_sheet([...meta, ...txRows]);
    wsA['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
    wsT['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsA, 'Accounts');
    XLSX.utils.book_append_sheet(wb, wsT, 'History');
    XLSX.writeFile(wb, outName("savings", "xlsx"));
    toast.success('Savings Excel downloaded');
  };

  const exportLoansXLSX = async () => {
    const profile = await getProfile();
    const { loans, ltxs } = await fetchLoanHistory();
    if (loans.length === 0 && ltxs.length === 0) { toast.error('No loan data'); return; }
    const loanMap = new Map(loans.map((l: any) => [l.id, l.person_name]));
    const wb = XLSX.utils.book_new();
    const meta = [
      ['CungaCash — Loans Report'], ['User', profile.name],
      ['Period', `${fromStr} – ${toStr}`], ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')], [],
    ];
    const lRows = [['Date', 'Person', 'Type', 'Outstanding (RWF)', 'Original (RWF)', 'Status', 'Description'],
      ...loans.map((l: any) => [l.loan_date, l.person_name, l.type, Number(l.amount),
        Number(l.original_amount ?? l.amount), l.status, l.description ?? ''])];
    const tRows = [['Date', 'Person', 'Action', 'Amount (RWF)', 'Receipt #', 'Note'],
      ...ltxs.map((t: any) => [format(new Date(t.occurred_at), 'yyyy-MM-dd HH:mm'),
        loanMap.get(t.loan_id) ?? '—', t.action, Number(t.amount), t.receipt_no, t.note ?? ''])];
    const wsL = XLSX.utils.aoa_to_sheet([...meta, ...lRows]);
    const wsT = XLSX.utils.aoa_to_sheet([...meta, ...tRows]);
    wsL['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 30 }];
    wsT['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsL, 'Loans');
    XLSX.utils.book_append_sheet(wb, wsT, 'Action History');
    XLSX.writeFile(wb, outName("loans", "xlsx"));
    toast.success('Loans Excel downloaded');
  };


  // ---------- Additional data fetchers ----------
  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('is_archived', false).order('created_at');
    return data ?? [];
  };
  const fetchGoals = async () => {
    const { data } = await supabase.from('financial_goals').select('*').order('created_at', { ascending: false });
    return data ?? [];
  };
  const fetchBudgets = async () => {
    const { data } = await supabase.from('budgets').select('*').order('category');
    return data ?? [];
  };
  const fetchRecurring = async () => {
    const { data } = await supabase.from('recurring_transactions').select('*').order('next_run_date');
    return data ?? [];
  };

  // ---------- Accounts PDF ----------
  const exportAccountsPDF = async () => {
    const accounts = await fetchAccounts();
    if (!accounts.length) { toast.error('No accounts to export'); return; }
    const report = await openReport('Accounts Portfolio Statement', 'AC');
    const d = report.doc;
    const total = accounts.reduce((s: number, a: any) => s + Number(a.current_balance ?? 0), 0);

    let y = report.beginSection('KPI Dashboard');
    report.drawKpiCards(y, [
      { label: 'Portfolio Value', value: `${fmt(total)} RWF`, sub: 'All active accounts', color: EMERALD },
      { label: 'Accounts', value: `${accounts.length}`, sub: 'Active', color: NAVY },
      { label: 'Account Types', value: `${new Set(accounts.map((a: any) => a.kind)).size}`, sub: 'Diversification', color: GOLD },
      { label: 'Currency', value: 'RWF', sub: 'Base currency', color: NAVY },
    ]);

    y = report.beginSection('Accounts Ledger');
    autoTable(d, {
      startY: y,
      head: [['Account', 'Type', 'Number', 'Current Balance', '% of Portfolio']],
      body: accounts.map((a: any) => [
        a.name, a.kind, a.account_number ?? '—',
        `${fmt(Number(a.current_balance))} RWF`,
        `${total > 0 ? ((Number(a.current_balance) / total) * 100).toFixed(1) : 0}%`,
      ]),
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: CHARCOAL },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220,226,232] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'center' } },
    });

    closeReport(report);
    report.save(outName(`${report.meta.reportId.toLowerCase()}`, "pdf"));
    toast.success('Accounts PDF downloaded');
  };

  const exportAccountsXLSX = async () => {
    const accounts = await fetchAccounts();
    if (!accounts.length) { toast.error('No accounts'); return; }
    const profile = await getProfile();
    const wb = XLSX.utils.book_new();
    const meta = [['CungaCash — Accounts'], ['User', profile.name], ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')], []];
    const rows = [['Name', 'Type', 'Number', 'Currency', 'Balance (RWF)'],
      ...accounts.map((a: any) => [a.name, a.kind, a.account_number ?? '', a.currency, Number(a.current_balance)])];
    const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows]);
    ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 20 }, { wch: 8 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
    XLSX.writeFile(wb, outName("accounts", "xlsx"));
    toast.success('Accounts Excel downloaded');
  };

  // ---------- Goals PDF ----------
  const exportGoalsPDF = async () => {
    const goals = await fetchGoals();
    if (!goals.length) { toast.error('No goals to export'); return; }
    const report = await openReport('Financial Goals Statement', 'GL');
    const d = report.doc;
    const totalTarget = goals.reduce((s: number, g: any) => s + Number(g.target_amount ?? 0), 0);
    const totalCurrent = goals.reduce((s: number, g: any) => s + Number(g.current_amount ?? 0), 0);
    const completed = goals.filter((g: any) => g.status === 'completed').length;

    let y = report.beginSection('KPI Dashboard');
    report.drawKpiCards(y, [
      { label: 'Total Target', value: `${fmt(totalTarget)} RWF`, sub: 'Combined objective', color: NAVY },
      { label: 'Saved So Far', value: `${fmt(totalCurrent)} RWF`, sub: 'Current progress', color: EMERALD },
      { label: 'Progress', value: `${totalTarget > 0 ? ((totalCurrent / totalTarget) * 100).toFixed(1) : 0}%`, sub: 'Overall completion', color: GOLD },
      { label: 'Completed', value: `${completed}/${goals.length}`, sub: 'Goals achieved', color: EMERALD },
    ]);

    y = report.beginSection('Goals Detail');
    autoTable(d, {
      startY: y,
      head: [['Goal', 'Category', 'Target', 'Current', 'Progress', 'Target Date', 'Status']],
      body: goals.map((g: any) => [
        g.name, g.category ?? '—',
        `${fmt(Number(g.target_amount))} RWF`,
        `${fmt(Number(g.current_amount))} RWF`,
        `${g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(1) : 0}%`,
        g.target_date ? format(new Date(g.target_date), 'yyyy-MM-dd') : '—',
        g.status,
      ]),
      headStyles: { fillColor: NAVY, textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: CHARCOAL },
      alternateRowStyles: { fillColor: LIGHT },
      styles: { cellPadding: 3, lineWidth: 0.1, lineColor: [220,226,232] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center' } },
    });

    closeReport(report);
    report.save(outName(`${report.meta.reportId.toLowerCase()}`, "pdf"));
    toast.success('Goals PDF downloaded');
  };

  const exportGoalsXLSX = async () => {
    const goals = await fetchGoals();
    if (!goals.length) { toast.error('No goals'); return; }
    const wb = XLSX.utils.book_new();
    const rows = [['Name', 'Category', 'Target (RWF)', 'Current (RWF)', 'Progress %', 'Target Date', 'Status', 'Notes'],
      ...goals.map((g: any) => [
        g.name, g.category ?? '', Number(g.target_amount), Number(g.current_amount),
        g.target_amount > 0 ? Number(((g.current_amount / g.target_amount) * 100).toFixed(2)) : 0,
        g.target_date ?? '', g.status, g.notes ?? '',
      ])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Goals');
    XLSX.writeFile(wb, outName("goals", "xlsx"));
    toast.success('Goals Excel downloaded');
  };

  // ---------- Budgets + Recurring Excel ----------
  const exportBudgetsRecurringXLSX = async () => {
    const [budgets, recurring] = await Promise.all([fetchBudgets(), fetchRecurring()]);
    if (!budgets.length && !recurring.length) { toast.error('No budgets or recurring items'); return; }
    const wb = XLSX.utils.book_new();
    if (budgets.length) {
      const rows = [['Category', 'Monthly Limit (RWF)', 'Alert Threshold %'],
        ...budgets.map((b: any) => [b.category, Number(b.monthly_limit), Number(b.alert_threshold ?? 80)])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Budgets');
    }
    if (recurring.length) {
      const rows = [['Description', 'Type', 'Category', 'Amount (RWF)', 'Frequency', 'Next Run', 'Active'],
        ...recurring.map((r: any) => [
          r.description ?? '', r.type, r.category,
          Number(r.quantity ?? 1) * Number(r.unit_price ?? 0),
          r.frequency, r.next_run_date, r.is_active ? 'Yes' : 'No',
        ])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Recurring');
    }
    XLSX.writeFile(wb, outName("budgets-recurring", "xlsx"));
    toast.success('Budgets & Recurring downloaded');
  };

  // ---------- Range presets ----------
  const applyPreset = (p: 'today' | '7d' | '30d' | 'mtd' | 'ytd') => {
    const now = new Date();
    if (p === 'today') { setFrom(now); setTo(now); }
    else if (p === '7d') { setFrom(subDays(now, 6)); setTo(now); }
    else if (p === '30d') { setFrom(subDays(now, 29)); setTo(now); }
    else if (p === 'mtd') { setFrom(startOfMonth(now)); setTo(now); }
    else if (p === 'ytd') { setFrom(startOfYear(now)); setTo(now); }
    setPreset(p === 'today' ? 'today' : p === '7d' ? 'last-7-days' : p === '30d' ? 'last-30-days' : p === 'mtd' ? 'month-to-date' : 'year-to-date');
  };

  const runExport = async (id: string, fn: () => Promise<void>, label: string) => {
    setBusy(id);
    try {
      await fn();
    } catch (e: any) {
      toast.error(`${label} failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setBusy(null);
    }
  };



  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Date Range</CardTitle>
          <CardDescription>Choose the period for your export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker label="From" date={from} onChange={setFrom} />
            <DatePicker label="To" date={to} onChange={setTo} />
          </div>
          <div className="flex flex-wrap gap-2">
            {([['today','Today'],['7d','Last 7 days'],['30d','Last 30 days'],['mtd','Month to date'],['ytd','Year to date']] as const).map(([k, label]) => (
              <Button key={k} size="sm" variant="outline" onClick={() => applyPreset(k)}>{label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>


      {transactions && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-income/5 border-income/20">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="text-base sm:text-lg font-bold text-income">{fmt(totals.income)} RWF</p>
            </CardContent>
          </Card>
          <Card className="bg-expense/5 border-expense/20">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Expense</p>
              <p className="text-base sm:text-lg font-bold text-expense">{fmt(totals.expense)} RWF</p>
            </CardContent>
          </Card>
          <Card className={totals.net >= 0 ? 'bg-income/5 border-income/20' : 'bg-expense/5 border-expense/20'}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Net</p>
              <p className={cn('text-base sm:text-lg font-bold', totals.net >= 0 ? 'text-income' : 'text-expense')}>{fmt(totals.net)} RWF</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Transactions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ExportCard icon={FileDown} color="primary" title="Transactions PDF"
            subtitle={txLoading ? 'Loading...' : `${transactions?.length ?? 0} records · enterprise format`}
            status={exportState['tx-pdf']} error={exportError['tx-pdf']} onClick={run('tx-pdf', exportTransactionsPDF)} />
          <ExportCard icon={FileSpreadsheet} color="primary" title="Transactions Excel"
            subtitle="Spreadsheet (.xlsx)"
            status={exportState['tx-xlsx']} error={exportError['tx-xlsx']} onClick={run('tx-xlsx', exportTransactionsXLSX)} />
          <ExportCard icon={FileText} color="accent" title="Daily Report PDF"
            subtitle={`${sumLoading ? '…' : (summaries?.length ?? 0)} days · with chart`}
            status={exportState['daily-pdf']} error={exportError['daily-pdf']} onClick={run('daily-pdf', exportDailyReportPDF)} />
          <ExportCard icon={BarChart3} color="primary" title="Boardroom Report"
            subtitle="Full 17-section enterprise PDF"
            status={exportState['board-pdf']} error={exportError['board-pdf']} onClick={run('board-pdf', exportMonthlySummaryPDF)} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Savings History</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExportCard icon={PiggyBank} color="primary" title="Savings PDF"
            subtitle="Accounts + history · enterprise"
            status={exportState['sav-pdf']} error={exportError['sav-pdf']} onClick={run('sav-pdf', exportSavingsPDF)} />
          <ExportCard icon={FileSpreadsheet} color="primary" title="Savings Excel"
            subtitle="Spreadsheet (.xlsx)"
            status={exportState['sav-xlsx']} error={exportError['sav-xlsx']} onClick={run('sav-xlsx', exportSavingsXLSX)} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Loans & Repayments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExportCard icon={HandCoins} color="accent" title="Loans PDF"
            subtitle="Ledger + actions · enterprise"
            status={exportState['loan-pdf']} error={exportError['loan-pdf']} onClick={run('loan-pdf', exportLoansPDF)} />
          <ExportCard icon={FileSpreadsheet} color="accent" title="Loans Excel"
            subtitle="Spreadsheet (.xlsx)"
            status={exportState['loan-xlsx']} error={exportError['loan-xlsx']} onClick={run('loan-xlsx', exportLoansXLSX)} />
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Accounts Portfolio</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExportCard icon={Wallet} color="primary" title="Accounts PDF"
            subtitle="Portfolio ledger · enterprise"
            status={exportState['acc-pdf']} error={exportError['acc-pdf']} onClick={run('acc-pdf', exportAccountsPDF)} />
          <ExportCard icon={FileSpreadsheet} color="primary" title="Accounts Excel"
            subtitle="Spreadsheet (.xlsx)"
            status={exportState['acc-xlsx']} error={exportError['acc-xlsx']} onClick={run('acc-xlsx', exportAccountsXLSX)} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Financial Goals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExportCard icon={Trophy} color="accent" title="Goals PDF"
            subtitle="Progress statement · enterprise"
            status={exportState['goal-pdf']} error={exportError['goal-pdf']} onClick={run('goal-pdf', exportGoalsPDF)} />
          <ExportCard icon={FileSpreadsheet} color="accent" title="Goals Excel"
            subtitle="Spreadsheet (.xlsx)"
            status={exportState['goal-xlsx']} error={exportError['goal-xlsx']} onClick={run('goal-xlsx', exportGoalsXLSX)} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Budgets & Recurring</h2>
        <div className="grid grid-cols-1 gap-3">
          <ExportCard icon={FileSpreadsheet} color="primary" title="Budgets & Recurring Excel"
            subtitle="Two-sheet workbook with plans"
            status={exportState['bud-xlsx']} error={exportError['bud-xlsx']} onClick={run('bud-xlsx', exportBudgetsRecurringXLSX)} />
        </div>
      </div>
    </div>
  );
}

function ExportCard({ icon: Icon, color, title, subtitle, onClick, status, error }: {
  icon: any; color: 'primary' | 'accent'; title: string; subtitle: string; onClick: () => void;
  status?: 'loading' | 'done' | 'error'; error?: string;
}) {
  const loading = status === 'loading';
  return (
    <Card
      className={cn('transition-shadow', loading ? 'opacity-70 cursor-wait' : 'hover:shadow-md cursor-pointer',
        status === 'error' && 'border-destructive/40', status === 'done' && 'border-income/40')}
      onClick={() => { if (!loading) onClick(); }}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          status === 'error' ? 'bg-destructive/10' : status === 'done' ? 'bg-income/10' : color === 'primary' ? 'bg-primary/10' : 'bg-accent/10')}>
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary" />
            : status === 'done' ? <CheckCircle2 className="w-6 h-6 text-income" />
            : status === 'error' ? <AlertCircle className="w-6 h-6 text-destructive" />
            : <Icon className={cn('w-6 h-6', color === 'primary' ? 'text-primary' : 'text-accent')} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{title}</p>
          <p className={cn('text-xs mt-0.5 truncate',
            status === 'error' ? 'text-destructive' : status === 'done' ? 'text-income' : 'text-muted-foreground')}>
            {loading ? 'Generating…' : status === 'done' ? 'Downloaded successfully' : status === 'error' ? (error || 'Export failed') : subtitle}
          </p>
        </div>
        {status === 'error' && (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}


function DatePicker({ label, date, onChange }: { label: string; date: Date; onChange: (d: Date) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />{format(date, 'PPP')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={(d) => d && onChange(d)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}
