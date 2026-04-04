import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTransactions, useDailySummaries } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ExportPage() {
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

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  const exportTransactionsPDF = () => {
    if (!transactions || transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(13, 150, 104);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('J.LucTRACKER', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Transaction Report', 14, 26);
    doc.text(`${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`, 14, 33);

    // Summary boxes
    doc.setTextColor(0, 0, 0);
    const boxY = 46;
    const boxW = (pageW - 42) / 3;

    // Income box
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, boxY, boxW, 24, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Total Income', 14 + boxW / 2, boxY + 9, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(13, 150, 104);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(totals.income), 14 + boxW / 2, boxY + 19, { align: 'center' });

    // Expense box
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14 + boxW + 7, boxY, boxW, 24, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text('Total Expense', 14 + boxW + 7 + boxW / 2, boxY + 9, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(totals.expense), 14 + boxW + 7 + boxW / 2, boxY + 19, { align: 'center' });

    // Net box
    const netColor = totals.net >= 0 ? [13, 150, 104] : [220, 38, 38];
    const netBg = totals.net >= 0 ? [236, 253, 245] : [254, 242, 242];
    doc.setFillColor(netBg[0], netBg[1], netBg[2]);
    doc.roundedRect(14 + (boxW + 7) * 2, boxY, boxW, 24, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text('Net Balance', 14 + (boxW + 7) * 2 + boxW / 2, boxY + 9, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(netColor[0], netColor[1], netColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(totals.net), 14 + (boxW + 7) * 2 + boxW / 2, boxY + 19, { align: 'center' });

    // Table
    const tableData = transactions.map((tx) => [
      format(new Date(tx.transaction_date), 'MMM d, yyyy'),
      tx.type,
      tx.category,
      tx.description || '-',
      String(tx.quantity ?? 1),
      fmt(tx.unit_price),
      fmt(tx.total_amount ?? 0),
      tx.payment_method || '-',
    ]);

    autoTable(doc, {
      startY: boxY + 32,
      head: [['Date', 'Type', 'Category', 'Description', 'Qty', 'Unit Price', 'Total', 'Payment']],
      body: tableData,
      headStyles: { fillColor: [13, 150, 104], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3, lineWidth: 0.1 },
      columnStyles: {
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'INCOME' ? [13, 150, 104] : [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated by J.LucTRACKER · rossets.rw · info@rossets.rw`, 14, pageH - 8);
      doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' });
    }

    doc.save(`J.LucTRACKER_Transactions_${fromStr}_${toStr}.pdf`);
    toast.success('Transactions PDF downloaded');
  };

  const exportDailyReportPDF = () => {
    if (!summaries || summaries.length === 0) {
      toast.error('No daily data to export');
      return;
    }

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(13, 150, 104);
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('J.LucTRACKER', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Daily Summary Report', 14, 26);
    doc.text(`${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`, 14, 33);

    const tableData = summaries.map((s) => [
      format(new Date(s.summary_date), 'EEE, MMM d, yyyy'),
      fmt(s.total_income ?? 0),
      fmt(s.total_expense ?? 0),
      fmt(s.net_balance ?? 0),
    ]);

    autoTable(doc, {
      startY: 46,
      head: [['Date', 'Income', 'Expense', 'Net Balance']],
      body: tableData,
      headStyles: { fillColor: [13, 150, 104], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 4, lineWidth: 0.1 },
      columnStyles: {
        1: { halign: 'right', textColor: [13, 150, 104] },
        2: { halign: 'right', textColor: [220, 38, 38] },
        3: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = parseFloat(String(data.cell.raw).replace(/,/g, ''));
          data.cell.styles.textColor = val >= 0 ? [13, 150, 104] : [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated by J.LucTRACKER · rossets.rw · info@rossets.rw`, 14, pageH - 8);
      doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' });
    }

    doc.save(`J.LucTRACKER_DailyReport_${fromStr}_${toStr}.pdf`);
    toast.success('Daily report PDF downloaded');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Date Range */}
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

      {/* Stats preview */}
      {transactions && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-income/5 border-income/20">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Income</p>
              <p className="text-lg font-bold text-income">{fmt(totals.income)}</p>
            </CardContent>
          </Card>
          <Card className="bg-expense/5 border-expense/20">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Expense</p>
              <p className="text-lg font-bold text-expense">{fmt(totals.expense)}</p>
            </CardContent>
          </Card>
          <Card className={totals.net >= 0 ? 'bg-income/5 border-income/20' : 'bg-expense/5 border-expense/20'}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Net</p>
              <p className={cn('text-lg font-bold', totals.net >= 0 ? 'text-income' : 'text-expense')}>{fmt(totals.net)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={exportTransactionsPDF}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileDown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Transactions PDF</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {txLoading ? 'Loading...' : `${transactions?.length ?? 0} records`}
              </p>
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
              <p className="text-xs text-muted-foreground mt-0.5">
                {sumLoading ? 'Loading...' : `${summaries?.length ?? 0} days`}
              </p>
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
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(date, 'PPP')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={(d) => d && onChange(d)} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}
