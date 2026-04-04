import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function BackupRestore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    try {
      const [txRes, catRes, sumRes, recRes, budRes] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('categories').select('*'),
        supabase.from('daily_summaries').select('*'),
        supabase.from('recurring_transactions').select('*'),
        supabase.from('budgets').select('*'),
      ]);

      const backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        app: 'J.LucTRACKER',
        data: {
          transactions: txRes.data ?? [],
          categories: catRes.data ?? [],
          daily_summaries: sumRes.data ?? [],
          recurring_transactions: recRes.data ?? [],
          budgets: budRes.data ?? [],
        },
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jluctracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.data || backup.app !== 'J.LucTRACKER') {
        toast.error('Invalid backup file');
        return;
      }

      // Import categories first
      if (backup.data.categories?.length) {
        const cats = backup.data.categories.map((c: any) => ({
          name: c.name,
          type: c.type,
          user_id: user.id,
        }));
        await supabase.from('categories').upsert(cats, { onConflict: 'id', ignoreDuplicates: true });
      }

      // Import transactions
      if (backup.data.transactions?.length) {
        const txs = backup.data.transactions.map((t: any) => ({ ...t, user_id: user.id }));
        for (let i = 0; i < txs.length; i += 50) {
          await supabase.from('transactions').upsert(txs.slice(i, i + 50), { onConflict: 'id', ignoreDuplicates: true });
        }
      }

      // Import recurring
      if (backup.data.recurring_transactions?.length) {
        const recs = backup.data.recurring_transactions.map((r: any) => ({ ...r, user_id: user.id }));
        await supabase.from('recurring_transactions').upsert(recs, { onConflict: 'id', ignoreDuplicates: true });
      }

      // Import budgets
      if (backup.data.budgets?.length) {
        const buds = backup.data.budgets.map((b: any) => ({ ...b, user_id: user.id }));
        await supabase.from('budgets').upsert(buds, { onConflict: 'id', ignoreDuplicates: true });
      }

      queryClient.invalidateQueries();
      toast.success('Data restored successfully');
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Download className="w-5 h-5" />Export Backup</CardTitle>
          <CardDescription>Download all your data as a JSON file</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} className="w-full gap-2">
            <Download className="w-4 h-4" />Download Backup
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="w-5 h-5" />Restore Backup</CardTitle>
          <CardDescription>Import data from a previously exported JSON file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 text-sm">
            <AlertTriangle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <p className="text-muted-foreground">Importing will merge data with existing records. Duplicates are skipped.</p>
          </div>
          <label className="block">
            <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing} />
            <Button variant="outline" className="w-full gap-2" disabled={importing} asChild>
              <span><Upload className="w-4 h-4" />{importing ? 'Importing...' : 'Select Backup File'}</span>
            </Button>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
