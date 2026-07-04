import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Wallet, MapPin, Store, Tag as TagIcon, HeartPulse, CalendarClock, Receipt, Paperclip,
  FileText, Download, Trash2, CheckCircle2, Upload, Sparkles, Copy,
} from 'lucide-react';
import { useAttachments, useUploadAttachment, useDeleteAttachment, getSignedUrl } from '@/hooks/useAttachments';
import { useAccounts } from '@/hooks/useAccounts';

const fmt = (n: number) => Number(n ?? 0).toLocaleString('en-RW', { minimumFractionDigits: 0 });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tx: any | null;
}

export default function TransactionDetailDialog({ open, onOpenChange, tx }: Props) {
  const { data: attachments } = useAttachments(tx?.id);
  const { data: accounts } = useAccounts();
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();

  if (!tx) return null;

  const account = accounts?.find(a => a.id === tx.account_id);
  const dow = tx.transaction_date ? format(new Date(tx.transaction_date), 'EEEE') : '';
  const period = tx.transaction_date ? format(new Date(tx.transaction_date), "MMMM yyyy") : '';
  const shortId = tx.id?.slice(0, 8).toUpperCase();

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      try { await upload.mutateAsync({ transaction_id: tx.id, file: f }); }
      catch (e: any) { toast.error(e.message); }
    }
    toast.success('Attached');
  };

  const openAttachment = async (path: string) => {
    try {
      const url = await getSignedUrl(path);
      window.open(url, '_blank');
    } catch (e: any) { toast.error(e.message); }
  };

  const copyId = () => { navigator.clipboard.writeText(tx.id); toast.success('Transaction ID copied'); };

  const generateReport = () => {
    const w = window.open('', '_blank', 'width=800,height=1100');
    if (!w) return;
    const rows = (label: string, val: any) => val ? `<tr><td style="padding:6px 12px;color:#64748b;font-size:12px">${label}</td><td style="padding:6px 12px;font-weight:500">${val}</td></tr>` : '';
    const attachmentsHtml = attachments?.length
      ? `<h3 style="margin-top:24px">Attachments</h3><ul>${attachments.map(a => `<li>${a.file_name} (${a.kind})</li>`).join('')}</ul>` : '';
    const tags = (tx.tags && tx.tags.length) ? tx.tags.join(', ') : '';
    w.document.write(`
      <html><head><title>Transaction ${shortId}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:720px;margin:0 auto}
      h1{margin:0;font-size:22px}.muted{color:#64748b;font-size:13px}
      .hero{background:#0d9668;color:white;padding:20px;border-radius:12px;margin:20px 0}
      .amt{font-size:32px;font-weight:800}
      table{border-collapse:collapse;width:100%;margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
      tr:nth-child(even){background:#f8fafc}
      h3{margin-top:24px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
      .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
      </style></head><body>
      <h1>CungaCash™ · Personal Financial Record</h1>
      <p class="muted">Report ID: ${shortId} · Generated ${format(new Date(), 'PPpp')}</p>
      <div class="hero">
        <div class="muted" style="color:#a7f3d0">${tx.type} · ${tx.category}${tx.subcategory ? ' / ' + tx.subcategory : ''}</div>
        <div class="amt">${tx.type === 'INCOME' ? '+' : '-'} ${fmt(tx.total_amount)} RWF</div>
        <div class="muted" style="color:#a7f3d0">${format(new Date(tx.transaction_date), 'PPPP')}${tx.transaction_time ? ' · ' + tx.transaction_time.slice(0, 5) : ''}</div>
      </div>
      <h3>Financial Details</h3>
      <table>
        ${rows('Status', tx.status || 'COMPLETED')}
        ${rows('Currency', tx.currency || 'RWF')}
        ${rows('Quantity × Unit Price', `${tx.quantity} × ${fmt(tx.unit_price)}`)}
        ${rows('Subtotal', fmt(tx.quantity * tx.unit_price) + ' RWF')}
        ${rows('Fee', tx.transaction_fee ? fmt(tx.transaction_fee) + ' RWF' : null)}
        ${rows('Discount', tx.discount ? fmt(tx.discount) + ' RWF' : null)}
        ${rows('Tax', tx.tax_amount ? fmt(tx.tax_amount) + ' RWF' : null)}
        ${rows('Final Amount', fmt(tx.final_amount || tx.total_amount) + ' RWF')}
        ${rows('Payment Method', tx.payment_method)}
        ${rows('Account', account?.name)}
      </table>
      <h3>Context</h3>
      <table>
        ${rows('Purpose', tx.purpose)}
        ${rows('Income Source', tx.income_source)}
        ${rows('Merchant / Payer', tx.merchant_name)}
        ${rows('Phone', tx.merchant_phone)}
        ${rows('Place', tx.place_type)}
        ${rows('City', tx.city)}
        ${rows('Country', tx.country)}
        ${rows('Mood', tx.mood)}
        ${rows('Life Event', tx.life_event)}
        ${rows('Tags', tags)}
      </table>
      ${tx.notes ? `<h3>Personal Journal</h3><p style="background:#f8fafc;padding:12px;border-radius:8px;line-height:1.6">${tx.notes}</p>` : ''}
      ${attachmentsHtml}
      <div class="footer">CungaCash™ · Developed by rossets.rw · This is your personal financial record.</div>
      <script>setTimeout(()=>window.print(),300)</script>
      </body></html>`);
    w.document.close();
  };

  const badge = (label: string, value?: string | null) => value ? (
    <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" /> Personal Financial Record</DialogTitle>
        </DialogHeader>

        {/* Hero */}
        <Card className="border-none bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <Badge className="bg-white/20 hover:bg-white/20 text-white border-none mb-1">{tx.type}</Badge>
                <p className="text-sm opacity-90">{tx.category}{tx.subcategory && ` · ${tx.subcategory}`}</p>
              </div>
              <button onClick={copyId} className="text-xs opacity-80 hover:opacity-100 flex items-center gap-1"><Copy className="w-3 h-3" />{shortId}</button>
            </div>
            <p className="text-4xl font-bold mt-2">{tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.total_amount)} <span className="text-lg opacity-80">RWF</span></p>
            <p className="text-xs opacity-80 mt-1"><CalendarClock className="w-3 h-3 inline mr-1" />{dow}, {format(new Date(tx.transaction_date), 'PPP')}{tx.transaction_time && ` · ${tx.transaction_time.slice(0, 5)}`}</p>
          </CardContent>
        </Card>

        {/* Money breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badge('Status', tx.status || 'Completed')}
          {badge('Payment', tx.payment_method)}
          {badge('Account', account?.name)}
          {badge('Currency', tx.currency || 'RWF')}
          {tx.transaction_fee > 0 && badge('Fee', fmt(tx.transaction_fee))}
          {tx.discount > 0 && badge('Discount', fmt(tx.discount))}
          {tx.tax_amount > 0 && badge('Tax', fmt(tx.tax_amount))}
          {badge('Period', period)}
        </div>

        {/* Context */}
        {(tx.merchant_name || tx.place_type || tx.purpose || tx.income_source) && <>
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Context</p>
            <div className="grid grid-cols-2 gap-3">
              {tx.merchant_name && <div className="flex gap-2"><Store className="w-4 h-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Merchant</p><p className="text-sm font-medium">{tx.merchant_name}</p>{tx.merchant_phone && <p className="text-xs text-muted-foreground">{tx.merchant_phone}</p>}</div></div>}
              {(tx.place_type || tx.city) && <div className="flex gap-2"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Location</p><p className="text-sm font-medium">{[tx.place_type, tx.city, tx.country].filter(Boolean).join(' · ')}</p></div></div>}
              {tx.purpose && <div className="flex gap-2"><Sparkles className="w-4 h-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Purpose</p><p className="text-sm font-medium">{tx.purpose}</p></div></div>}
              {tx.income_source && <div className="flex gap-2"><Wallet className="w-4 h-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Source</p><p className="text-sm font-medium">{tx.income_source}</p></div></div>}
              {tx.mood && <div className="flex gap-2"><HeartPulse className="w-4 h-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Mood</p><p className="text-sm font-medium">{tx.mood}</p></div></div>}
              {tx.life_event && <div className="flex gap-2"><CalendarClock className="w-4 h-4 text-muted-foreground mt-0.5" /><div><p className="text-xs text-muted-foreground">Life Event</p><p className="text-sm font-medium">{tx.life_event}</p></div></div>}
            </div>
          </div>
        </>}

        {tx.tags?.length ? <>
          <Separator />
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><TagIcon className="w-3 h-3" /> Tags</p>
            <div className="flex flex-wrap gap-1.5">{tx.tags.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
          </div>
        </> : null}

        {tx.notes && <>
          <Separator />
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Personal Journal</p>
            <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg leading-relaxed">{tx.notes}</p>
          </div>
        </>}

        {/* Attachments */}
        <Separator />
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Paperclip className="w-3 h-3" /> Receipts & Files</p>
            <label className="cursor-pointer">
              <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={e => handleUpload(e.target.files)} />
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted"><Upload className="w-3 h-3" /> Upload</span>
            </label>
          </div>
          {attachments?.length ? (
            <div className="space-y-1.5">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{a.file_name}</span>
                  <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAttachment(a.storage_path)}><Download className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(a)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground py-2">No attachments. Upload receipts, invoices or photos.</p>}
        </div>

        {/* Timeline */}
        <Separator />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timeline</p>
          <ol className="space-y-1.5 text-xs">
            <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> <span className="text-muted-foreground">{format(new Date(tx.created_at), 'PPp')} —</span> Record created</li>
            <li className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> <span className="text-muted-foreground">auto —</span> Daily summary updated</li>
            {attachments?.map(a => <li key={a.id} className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> <span className="text-muted-foreground">{format(new Date(a.created_at), 'PPp')} —</span> {a.file_name} attached</li>)}
          </ol>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={generateReport} className="flex-1"><FileText className="w-4 h-4 mr-2" /> Generate Report</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
