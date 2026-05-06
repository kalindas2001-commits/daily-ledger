import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileDown, FileText, BarChart3, PiggyBank, HandCoins, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTransactions, useDailySummaries } from '@/hooks/useTransactions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PRIMARY: [number, number, number] = [13, 150, 104];
const EXPENSE: [number, number, number] = [220, 38, 38];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

// 12-color palette for chart slices
const PALETTE: [number, number, number][] = [
  [13, 150, 104], [220, 38, 38], [37, 99, 235], [217, 119, 6],
  [139, 92, 246], [14, 165, 233], [236, 72, 153], [5, 150, 105],
  [202, 138, 4], [124, 58, 237], [219, 39, 119], [2, 132, 199],
];

export default function ExportPage() {
  const { user } = useAuth();
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));

  const fromStr = format(from, 'yyyy-MM-dd');
  const toStr = format(to, 'yyyy-MM-dd');

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

  // ---------- Drawing helpers (vector charts in jsPDF) ----------
  const drawLogo = (doc: jsPDF, x: number, y: number, size: number) => {
    // Rounded green square with white "CC" monogram
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, size, size, size * 0.22, size * 0.22, 'F');
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(x + 0.5, y + 0.5, size - 1, size - 1, size * 0.2, size * 0.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size * 0.55);
    doc.text('CC', x + size / 2, y + size * 0.7, { align: 'center' });
  };

  const drawPie = (
    doc: jsPDF, cx: number, cy: number, r: number,
    slices: { label: string; value: number; color: [number, number, number] }[]
  ) => {
    const total = slices.reduce((s, x) => s + x.value, 0);
    if (total <= 0) {
      doc.setDrawColor(...MUTED); doc.setFillColor(241, 245, 249);
      doc.circle(cx, cy, r, 'F');
      return;
    }
    let startAngle = -Math.PI / 2;
    const STEP = Math.PI / 90; // 2°
    for (const s of slices) {
      if (s.value <= 0) continue;
      const sweep = (s.value / total) * Math.PI * 2;
      const endAngle = startAngle + sweep;
      doc.setFillColor(...s.color);
      // Approximate slice with triangle fan
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
    // Donut hole for modern look
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r * 0.45, 'F');
    doc.setTextColor(...INK);
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
    // Axes
    doc.setDrawColor(...MUTED); doc.setLineWidth(0.2);
    doc.line(x + padL, y + padT, x + padL, y + padT + innerH);
    doc.line(x + padL, y + padT + innerH, x + w - 2, y + padT + innerH);
    // Y labels (3 ticks)
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
      doc.setFillColor(...PRIMARY);
      doc.rect(cx - barW - 0.5, y + padT + innerH - ihh, barW, ihh, 'F');
      doc.setFillColor(...EXPENSE);
      doc.rect(cx + 0.5, y + padT + innerH - ehh, barW, ehh, 'F');
      doc.setTextColor(...MUTED); doc.setFontSize(6);
      doc.text(s.label, cx, y + padT + innerH + 4, { align: 'center' });
    });
    // Mini-legend
    doc.setFillColor(...PRIMARY); doc.rect(x + w - 36, y + 1, 2.5, 2.5, 'F');
    doc.setTextColor(...INK); doc.setFontSize(6); doc.text('Income', x + w - 32, y + 3);
    doc.setFillColor(...EXPENSE); doc.rect(x + w - 18, y + 1, 2.5, 2.5, 'F');
    doc.text('Expense', x + w - 14, y + 3);
  };

  // ---------- Header / footer / summary ----------
  const addHeader = (doc: jsPDF, title: string, profile: { name: string; email: string }) => {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageW, 42, 'F');
    drawLogo(doc, 14, 8, 26);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('CungaCash', 46, 18);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(title, 46, 26);
    doc.setFontSize(8);
    doc.text(`${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`, 46, 32);
    // Right side: user
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(profile.name, pageW - 14, 18, { align: 'right' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(profile.email, pageW - 14, 23, { align: 'right' });
    doc.text(`Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageW - 14, 28, { align: 'right' });
  };

  const addFooters = (doc: jsPDF) => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(230); doc.setLineWidth(0.2);
      doc.line(14, pageH - 12, pageW - 14, pageH - 12);
      doc.setFontSize(7); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
      doc.text('CungaCash · rossets.rw · info@rossets.rw', 14, pageH - 7);
      doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 7, { align: 'right' });
    }
  };

  const addSummaryBoxes = (doc: jsPDF, y: number) => {
    const pageW = doc.internal.pageSize.getWidth();
    const boxW = (pageW - 42) / 3;
    doc.setTextColor(0, 0, 0);

    const boxes = [
      { label: 'Total Income', val: totals.income, color: PRIMARY, bg: [236, 253, 245] },
      { label: 'Total Expense', val: totals.expense, color: EXPENSE, bg: [254, 242, 242] },
      { label: 'Net Balance', val: totals.net,
        color: (totals.net >= 0 ? PRIMARY : EXPENSE) as [number, number, number],
        bg: (totals.net >= 0 ? [236, 253, 245] : [254, 242, 242]) as number[] },
    ];

    boxes.forEach((b, i) => {
      const x = 14 + (boxW + 7) * i;
      doc.setFillColor(b.bg[0], b.bg[1], b.bg[2]);
      doc.roundedRect(x, y, boxW, 26, 3, 3, 'F');
      doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
      doc.text(b.label, x + boxW / 2, y + 9, { align: 'center' });
      doc.setFontSize(14); doc.setTextColor(b.color[0], b.color[1], b.color[2]); doc.setFont('helvetica', 'bold');
      doc.text(`${fmt(b.val)} RWF`, x + boxW / 2, y + 20, { align: 'center' });
    });
  };

  // ---------- Smart insights ----------
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

    const insights: string[] = [];
    const savingRate = totals.income > 0 ? (totals.net / totals.income) * 100 : 0;
    if (totals.income > 0) {
      if (savingRate >= 20) insights.push(`Strong savings rate of ${savingRate.toFixed(1)}% — you kept ${fmt(totals.net)} RWF of every income earned.`);
      else if (savingRate >= 0) insights.push(`Modest savings rate of ${savingRate.toFixed(1)}%. Aim for 20%+ to build a healthy buffer.`);
      else insights.push(`You spent ${(-savingRate).toFixed(1)}% more than you earned — net deficit of ${fmt(-totals.net)} RWF.`);
    }
    insights.push(`Average daily spending: ${fmt(totals.expense / days)} RWF over ${days} day${days > 1 ? 's' : ''}.`);
    const topExp = Object.entries(expByCat).sort((a, b) => b[1] - a[1])[0];
    if (topExp && totals.expense > 0) {
      const pct = (topExp[1] / totals.expense) * 100;
      insights.push(`Largest expense category: "${topExp[0]}" at ${fmt(topExp[1])} RWF (${pct.toFixed(1)}% of spending).`);
    }
    const topInc = Object.entries(incByCat).sort((a, b) => b[1] - a[1])[0];
    if (topInc && totals.income > 0) {
      const pct = (topInc[1] / totals.income) * 100;
      insights.push(`Top income source: "${topInc[0]}" contributing ${pct.toFixed(1)}% of total income.`);
    }
    const peak = Object.entries(dailyExp).sort((a, b) => b[1] - a[1])[0];
    if (peak) {
      insights.push(`Peak spending day: ${format(new Date(peak[0]), 'MMM d, yyyy')} with ${fmt(peak[1])} RWF.`);
    }
    insights.push(`${transactions.length} transaction${transactions.length > 1 ? 's' : ''} recorded across ${Object.keys(expByCat).length + Object.keys(incByCat).length} categories.`);
    return insights;
  };

  const drawInsights = (doc: jsPDF, y: number, insights: string[]) => {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
    const h = 10 + insights.length * 5.5;
    doc.roundedRect(14, y, pageW - 28, h, 2, 2, 'FD');
    doc.setTextColor(...PRIMARY); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Smart Insights', 18, y + 6);
    doc.setTextColor(...INK); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    insights.forEach((t, i) => {
      doc.setTextColor(...PRIMARY); doc.text('•', 18, y + 12 + i * 5.5);
      doc.setTextColor(...INK);
      doc.text(t, 22, y + 12 + i * 5.5, { maxWidth: pageW - 44 });
    });
    return y + h + 6;
  };

  // ---------- Profile fetch ----------
  const getProfile = async (): Promise<{ name: string; email: string }> => {
    if (!user) return { name: '—', email: '' };
    const { data } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
    const fallback = user.email?.split('@')[0] ?? 'User';
    return { name: data?.full_name?.trim() || fallback, email: user.email ?? '' };
  };

  // ---------- Reports ----------
  const exportTransactionsPDF = async () => {
    if (!transactions || transactions.length === 0) { toast.error('No transactions to export'); return; }
    const profile = await getProfile();
    const doc = new jsPDF();
    addHeader(doc, 'Transaction Report', profile);
    addSummaryBoxes(doc, 50);

    const tableData = transactions.map((tx) => [
      format(new Date(tx.transaction_date), 'MMM d, yyyy'),
      tx.type, tx.category, tx.description || '-',
      String(tx.quantity ?? 1), `${fmt(tx.unit_price)} RWF`,
      `${fmt(tx.total_amount ?? 0)} RWF`, tx.payment_method || '-',
    ]);

    autoTable(doc, {
      startY: 82,
      head: [['Date', 'Type', 'Category', 'Description', 'Qty', 'Unit Price', 'Total', 'Payment']],
      body: tableData,
      headStyles: { fillColor: PRIMARY, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3, lineWidth: 0.1 },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'INCOME' ? PRIMARY : EXPENSE;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    addFooters(doc);
    doc.save(`CungaCash_Transactions_${fromStr}_${toStr}.pdf`);
    toast.success('Transactions PDF downloaded');
  };

  const exportDailyReportPDF = async () => {
    if (!summaries || summaries.length === 0) { toast.error('No daily data to export'); return; }
    const profile = await getProfile();
    const doc = new jsPDF();
    addHeader(doc, 'Daily Summary Report', profile);
    addSummaryBoxes(doc, 50);

    // Mini bar chart of recent days (max 14)
    const recent = summaries.slice(-14).map((s) => ({
      label: format(new Date(s.summary_date), 'd/M'),
      income: Number(s.total_income ?? 0),
      expense: Number(s.total_expense ?? 0),
    }));
    const pageW = doc.internal.pageSize.getWidth();
    doc.setTextColor(...INK); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Daily Income vs Expense', 14, 86);
    drawBars(doc, 14, 88, pageW - 28, 50, recent);

    const tableData = summaries.map((s) => [
      format(new Date(s.summary_date), 'EEE, MMM d, yyyy'),
      `${fmt(s.total_income ?? 0)} RWF`, `${fmt(s.total_expense ?? 0)} RWF`, `${fmt(s.net_balance ?? 0)} RWF`,
    ]);

    autoTable(doc, {
      startY: 145,
      head: [['Date', 'Income', 'Expense', 'Net Balance']],
      body: tableData,
      headStyles: { fillColor: PRIMARY, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 4, lineWidth: 0.1 },
      columnStyles: {
        1: { halign: 'right', textColor: PRIMARY },
        2: { halign: 'right', textColor: EXPENSE },
        3: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = parseFloat(String(data.cell.raw).replace(/[^0-9.-]/g, ''));
          data.cell.styles.textColor = val >= 0 ? PRIMARY : EXPENSE;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    addFooters(doc);
    doc.save(`CungaCash_DailyReport_${fromStr}_${toStr}.pdf`);
    toast.success('Daily report PDF downloaded');
  };

  const exportMonthlySummaryPDF = async () => {
    if (!transactions || transactions.length === 0) { toast.error('No data to export'); return; }
    const profile = await getProfile();
    const doc = new jsPDF();
    addHeader(doc, 'Financial Summary Report', profile);
    addSummaryBoxes(doc, 50);

    // Insights
    let y = drawInsights(doc, 80, computeInsights());

    // Build category maps
    const expenseMap: Record<string, number> = {};
    const incomeMap: Record<string, number> = {};
    const paymentMap: Record<string, number> = {};
    transactions.forEach((tx) => {
      const amt = tx.total_amount ?? 0;
      if (tx.type === 'EXPENSE') expenseMap[tx.category] = (expenseMap[tx.category] ?? 0) + amt;
      else incomeMap[tx.category] = (incomeMap[tx.category] ?? 0) + amt;
      if (tx.payment_method) paymentMap[tx.payment_method] = (paymentMap[tx.payment_method] ?? 0) + amt;
    });

    // ---- Pie charts: Expense and Income side-by-side
    const pageW = doc.internal.pageSize.getWidth();
    if (y > 180) { doc.addPage(); y = 20; }

    doc.setTextColor(...INK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Expense Breakdown', 14, y);
    doc.text('Income Breakdown', pageW / 2 + 4, y);
    y += 4;

    const expSlices = Object.entries(expenseMap).sort((a, b) => b[1] - a[1])
      .slice(0, 8).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
    const incSlices = Object.entries(incomeMap).sort((a, b) => b[1] - a[1])
      .slice(0, 8).map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

    drawPie(doc, 36, y + 24, 22, expSlices);
    drawLegend(doc, 62, y + 6, 28, expSlices, totals.expense);

    drawPie(doc, pageW / 2 + 26, y + 24, 22, incSlices);
    drawLegend(doc, pageW / 2 + 52, y + 6, 28, incSlices, totals.income);

    y += 60;

    // Expense table
    if (y > 240) { doc.addPage(); y = 20; }
    const expenseRows = Object.entries(expenseMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [
      cat, `${fmt(amt)} RWF`, `${totals.expense > 0 ? ((amt / totals.expense) * 100).toFixed(1) : 0}%`
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Expense Category', 'Amount', '% of Total']],
      body: expenseRows,
      headStyles: { fillColor: EXPENSE, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      styles: { cellPadding: 3, lineWidth: 0.1 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (Object.keys(incomeMap).length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      const incomeRows = Object.entries(incomeMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [
        cat, `${fmt(amt)} RWF`, `${totals.income > 0 ? ((amt / totals.income) * 100).toFixed(1) : 0}%`
      ]);
      autoTable(doc, {
        startY: y,
        head: [['Income Category', 'Amount', '% of Total']],
        body: incomeRows,
        headStyles: { fillColor: PRIMARY, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        styles: { cellPadding: 3, lineWidth: 0.1 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (Object.keys(paymentMap).length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      const totalAll = totals.income + totals.expense;
      const payRows = Object.entries(paymentMap).sort((a, b) => b[1] - a[1]).map(([method, amt]) => [
        method, `${fmt(amt)} RWF`, `${totalAll > 0 ? ((amt / totalAll) * 100).toFixed(1) : 0}%`
      ]);
      autoTable(doc, {
        startY: y,
        head: [['Payment Method', 'Amount', '% of Total']],
        body: payRows,
        headStyles: { fillColor: MUTED, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { cellPadding: 3, lineWidth: 0.1 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
      });
    }

    addFooters(doc);
    doc.save(`CungaCash_Summary_${fromStr}_${toStr}.pdf`);
    toast.success('Summary PDF downloaded');
  };

  // ---------- Savings & Loans data ----------
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

  // ---------- Excel exports ----------
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
    XLSX.writeFile(wb, `CungaCash_Transactions_${fromStr}_${toStr}.xlsx`);
    toast.success('Transactions Excel downloaded');
  };

  const exportSavingsPDF = async () => {
    const profile = await getProfile();
    const { accounts, txs } = await fetchSavingsHistory();
    if (accounts.length === 0 && txs.length === 0) { toast.error('No savings data in this range'); return; }

    const doc = new jsPDF();
    addHeader(doc, 'Savings History Report', profile);

    const totalBalance = accounts.reduce((s, a: any) => s + Number(a.current_balance ?? 0), 0);
    const deposits = txs.filter((t: any) => t.action === 'DEPOSIT').reduce((s, t: any) => s + Number(t.amount), 0);
    const withdrawals = txs.filter((t: any) => t.action === 'WITHDRAW').reduce((s, t: any) => s + Number(t.amount), 0);

    const pageW = doc.internal.pageSize.getWidth();
    const boxW = (pageW - 42) / 3;
    const y0 = 50;
    [
      { label: 'Current Balance', val: totalBalance, color: PRIMARY, bg: [236, 253, 245] },
      { label: 'Deposits', val: deposits, color: PRIMARY, bg: [236, 253, 245] },
      { label: 'Withdrawals', val: withdrawals, color: EXPENSE, bg: [254, 242, 242] },
    ].forEach((b, i) => {
      const x = 14 + (boxW + 7) * i;
      doc.setFillColor(b.bg[0], b.bg[1], b.bg[2]);
      doc.roundedRect(x, y0, boxW, 26, 3, 3, 'F');
      doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
      doc.text(b.label, x + boxW / 2, y0 + 9, { align: 'center' });
      doc.setFontSize(13); doc.setTextColor(b.color[0], b.color[1], b.color[2]); doc.setFont('helvetica', 'bold');
      doc.text(`${fmt(b.val)} RWF`, x + boxW / 2, y0 + 20, { align: 'center' });
    });

    let y = 86;
    if (accounts.length > 0) {
      doc.setTextColor(...INK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Savings Accounts', 14, y); y += 2;
      autoTable(doc, {
        startY: y + 2,
        head: [['Account', 'Current Balance', 'Goal', 'Progress']],
        body: accounts.map((a: any) => [
          a.name,
          `${fmt(a.current_balance)} RWF`,
          a.goal_amount > 0 ? `${fmt(a.goal_amount)} RWF` : '—',
          a.goal_amount > 0 ? `${Math.min(100, ((a.current_balance / a.goal_amount) * 100)).toFixed(1)}%` : '—',
        ]),
        headStyles: { fillColor: PRIMARY, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 3, lineWidth: 0.1 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'center' } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (txs.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      const acctMap = new Map(accounts.map((a: any) => [a.id, a.name]));
      doc.setTextColor(...INK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Transaction History', 14, y);
      autoTable(doc, {
        startY: y + 2,
        head: [['Date', 'Account', 'Action', 'Amount', 'Receipt #', 'Note']],
        body: txs.map((t: any) => [
          format(new Date(t.occurred_at), 'MMM d, yyyy HH:mm'),
          acctMap.get(t.account_id) ?? '—',
          t.action,
          `${fmt(t.amount)} RWF`,
          t.receipt_no,
          t.note ?? '',
        ]),
        headStyles: { fillColor: PRIMARY, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { cellPadding: 2.5, lineWidth: 0.1 },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 2) {
            d.cell.styles.textColor = d.cell.raw === 'DEPOSIT' ? PRIMARY : EXPENSE;
            d.cell.styles.fontStyle = 'bold';
          }
        },
      });
    }

    addFooters(doc);
    doc.save(`CungaCash_Savings_${fromStr}_${toStr}.pdf`);
    toast.success('Savings PDF downloaded');
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
    XLSX.writeFile(wb, `CungaCash_Savings_${fromStr}_${toStr}.xlsx`);
    toast.success('Savings Excel downloaded');
  };

  const exportLoansPDF = async () => {
    const profile = await getProfile();
    const { loans, ltxs } = await fetchLoanHistory();
    if (loans.length === 0 && ltxs.length === 0) { toast.error('No loan data in this range'); return; }
    const doc = new jsPDF();
    addHeader(doc, 'Loans & Repayments Report', profile);

    const oweMe = loans.filter((l: any) => l.type === 'GIVEN' && l.status === 'PENDING').reduce((s, l: any) => s + Number(l.amount), 0);
    const iOwe = loans.filter((l: any) => l.type === 'RECEIVED' && l.status === 'PENDING').reduce((s, l: any) => s + Number(l.amount), 0);
    const repaid = ltxs.filter((t: any) => t.action !== 'ADD').reduce((s, t: any) => s + Number(t.amount), 0);

    const pageW = doc.internal.pageSize.getWidth();
    const boxW = (pageW - 42) / 3;
    const y0 = 50;
    [
      { label: 'People Owe Me', val: oweMe, color: PRIMARY, bg: [236, 253, 245] },
      { label: 'I Owe', val: iOwe, color: EXPENSE, bg: [254, 242, 242] },
      { label: 'Repayments (period)', val: repaid, color: PRIMARY, bg: [236, 253, 245] },
    ].forEach((b, i) => {
      const x = 14 + (boxW + 7) * i;
      doc.setFillColor(b.bg[0], b.bg[1], b.bg[2]);
      doc.roundedRect(x, y0, boxW, 26, 3, 3, 'F');
      doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
      doc.text(b.label, x + boxW / 2, y0 + 9, { align: 'center' });
      doc.setFontSize(13); doc.setTextColor(b.color[0], b.color[1], b.color[2]); doc.setFont('helvetica', 'bold');
      doc.text(`${fmt(b.val)} RWF`, x + boxW / 2, y0 + 20, { align: 'center' });
    });

    let y = 86;
    if (loans.length > 0) {
      doc.setTextColor(...INK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Loans', 14, y);
      autoTable(doc, {
        startY: y + 2,
        head: [['Date', 'Person', 'Type', 'Outstanding', 'Status', 'Notes']],
        body: loans.map((l: any) => [
          format(new Date(l.loan_date), 'MMM d, yyyy'),
          l.person_name, l.type, `${fmt(l.amount)} RWF`, l.status, l.description ?? '',
        ]),
        headStyles: { fillColor: PRIMARY, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 3, lineWidth: 0.1 },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 2) {
            d.cell.styles.textColor = d.cell.raw === 'GIVEN' ? PRIMARY : EXPENSE;
            d.cell.styles.fontStyle = 'bold';
          }
          if (d.section === 'body' && d.column.index === 4) {
            d.cell.styles.textColor = d.cell.raw === 'PAID' ? PRIMARY : MUTED;
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (ltxs.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      const loanMap = new Map(loans.map((l: any) => [l.id, l.person_name]));
      doc.setTextColor(...INK); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('Action History', 14, y);
      autoTable(doc, {
        startY: y + 2,
        head: [['Date', 'Person', 'Action', 'Amount', 'Receipt #', 'Note']],
        body: ltxs.map((t: any) => [
          format(new Date(t.occurred_at), 'MMM d, yyyy HH:mm'),
          loanMap.get(t.loan_id) ?? '—',
          t.action,
          `${fmt(t.amount)} RWF`,
          t.receipt_no,
          t.note ?? '',
        ]),
        headStyles: { fillColor: PRIMARY, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { cellPadding: 2.5, lineWidth: 0.1 },
        columnStyles: { 3: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 2) {
            d.cell.styles.textColor = d.cell.raw === 'ADD' ? EXPENSE : PRIMARY;
            d.cell.styles.fontStyle = 'bold';
          }
        },
      });
    }

    addFooters(doc);
    doc.save(`CungaCash_Loans_${fromStr}_${toStr}.pdf`);
    toast.success('Loans PDF downloaded');
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
    XLSX.writeFile(wb, `CungaCash_Loans_${fromStr}_${toStr}.xlsx`);
    toast.success('Loans Excel downloaded');
  };


  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Date Range</CardTitle>
          <CardDescription>Choose the period for your export</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker label="From" date={from} onChange={setFrom} />
            <DatePicker label="To" date={to} onChange={setTo} />
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportTransactionsPDF}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileDown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Transactions PDF</p>
              <p className="text-xs text-muted-foreground mt-0.5">{txLoading ? 'Loading...' : `${transactions?.length ?? 0} records`}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportDailyReportPDF}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-sm">Daily Report PDF</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sumLoading ? 'Loading...' : `${summaries?.length ?? 0} days`} · with chart</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportMonthlySummaryPDF}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Smart Summary</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pies + insights</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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
