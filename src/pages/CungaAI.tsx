import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { format, subMonths } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, SendHorizontal, TrendingUp, TrendingDown, Wallet, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTransactions, useBudgets } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useSavingsAccounts } from '@/hooks/useSavings';
import { useLoans } from '@/hooks/useLoans';
import { useGoals } from '@/hooks/useGoals';


const fmt = (n: number) => Number(n ?? 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

interface Msg { role: 'user' | 'assistant'; content: string }

const STARTERS = [
  'Analyse my current cash flow and tell me where I am losing money.',
  'How much should I save monthly to stay safe for 6 months?',
  'Which of my expense categories should I cut first, and by how much?',
  'How does inflation in Rwanda affect my savings plan this year?',
];

export default function CungaAI() {
  const { data: txs } = useTransactions();
  const { data: accounts } = useAccounts();
  const { data: savings } = useSavingsAccounts();
  const { data: loans } = useLoans();
  const { data: goals } = useGoals();
  const { data: budgets } = useBudgets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const snapshot = useMemo(() => {
    const rows: any[] = txs ?? [];
    const sum = (f: (t: any) => boolean) => rows.filter(f).reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
    const income = sum(t => t.type === 'INCOME');
    const expense = sum(t => t.type === 'EXPENSE');

    const byCat: Record<string, number> = {};
    rows.filter(t => t.type === 'EXPENSE').forEach(t => { byCat[t.category] = (byCat[t.category] ?? 0) + Number(t.total_amount ?? 0); });
    const topExpenseCategories = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([category, amount]) => ({ category, amount }));

    const monthly: { month: string; income: number; expense: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      const inM = (t: any) => String(t.transaction_date).slice(0, 7) === key;
      const mi = sum(t => inM(t) && t.type === 'INCOME');
      const me = sum(t => inM(t) && t.type === 'EXPENSE');
      monthly.push({ month: format(d, 'MMM yyyy'), income: mi, expense: me, net: mi - me });
    }

    const monthKey = format(new Date(), 'yyyy-MM');
    const spentThisMonthByCat: Record<string, number> = {};
    rows.filter(t => t.type === 'EXPENSE' && String(t.transaction_date).slice(0, 7) === monthKey)
      .forEach(t => { spentThisMonthByCat[t.category] = (spentThisMonthByCat[t.category] ?? 0) + Number(t.total_amount ?? 0); });

    const savingsBalance = (savings ?? []).reduce((s: number, a: any) => s + Number(a.current_balance ?? 0), 0);
    const accountsBalance = (accounts ?? []).reduce((s: number, a: any) => s + Number(a.current_balance ?? 0), 0);
    const owedToMe = (loans ?? []).filter((l: any) => l.type === 'GIVEN' && l.status === 'PENDING')
      .reduce((s: number, l: any) => s + Number(l.amount ?? 0), 0);
    const iOwe = (loans ?? []).filter((l: any) => l.type === 'RECEIVED' && l.status === 'PENDING')
      .reduce((s: number, l: any) => s + Number(l.amount ?? 0), 0);
    const avgMonthlyExpense = monthly.length ? monthly.reduce((s, m) => s + m.expense, 0) / monthly.length : 0;

    return {
      currency: 'RWF',
      generated_at: new Date().toISOString(),
      totals: { income, expense, net_balance: income - expense, records: rows.length },
      savings_rate_pct: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
      last_6_months: monthly,
      avg_monthly_expense: Math.round(avgMonthlyExpense),
      emergency_fund_months: avgMonthlyExpense > 0
        ? Number(((savingsBalance + accountsBalance) / avgMonthlyExpense).toFixed(1)) : null,
      top_expense_categories: topExpenseCategories,
      accounts: (accounts ?? []).map((a: any) => ({
        name: a.name, kind: a.kind, currency: a.currency,
        balance: Number(a.current_balance ?? 0), archived: !!a.is_archived,
      })),
      accounts_total_balance: accountsBalance,
      savings: {
        total_balance: savingsBalance,
        accounts: (savings ?? []).map((s: any) => ({
          name: s.name, balance: Number(s.current_balance ?? 0), goal: Number(s.goal_amount ?? 0) || null,
        })),
      },
      loans: {
        owed_to_me_pending: owedToMe,
        i_owe_pending: iOwe,
        items: (loans ?? []).slice(0, 20).map((l: any) => ({
          person: l.person_name, type: l.type, status: l.status,
          amount: Number(l.amount ?? 0), date: l.loan_date,
        })),
      },
      goals: (goals ?? []).map((g: any) => ({
        name: g.name, target: Number(g.target_amount ?? 0), saved: Number(g.current_amount ?? 0),
        target_date: g.target_date, status: g.status,
        progress_pct: g.target_amount ? Math.round((Number(g.current_amount ?? 0) / Number(g.target_amount)) * 100) : 0,
      })),
      budgets: (budgets ?? []).map((b: any) => ({
        category: b.category,
        monthly_limit: Number(b.monthly_limit ?? 0),
        spent_this_month: Math.round(spentThisMonthByCat[b.category] ?? 0),
        used_pct: b.monthly_limit
          ? Math.round(((spentThisMonthByCat[b.category] ?? 0) / Number(b.monthly_limit)) * 100) : 0,
      })),
      recent_transactions: rows.slice(0, 25).map(t => ({
        date: t.transaction_date, type: t.type, category: t.category,
        amount: Number(t.total_amount ?? 0), payment_method: t.payment_method,
        merchant: (t as any).merchant_name ?? null,
      })),
    };
  }, [txs, accounts, savings, loans, goals, budgets]);


  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || streaming) return;
    const next: Msg[] = [...messages, { role: 'user', content: question }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cungacash-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, snapshot }),
      });

      if (res.status === 429) throw new Error('CungaCash AI is busy right now — please retry in a moment.');
      if (res.status === 402) throw new Error('AI credits are exhausted for this workspace.');
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'CungaCash AI could not answer. Please try again.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: acc };
          return copy;
        });
      }
      if (!acc.trim()) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: '_No answer was returned. Please rephrase your finance question._' };
          return copy;
        });
      }
    } catch (e: any) {
      setMessages(prev => prev.slice(0, -1));
      toast.error(e?.message ?? 'CungaCash AI failed');
    } finally {
      setStreaming(false);
    }
  };

  const net = snapshot.totals.net_balance;

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <Card className="overflow-hidden border-primary/20">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 flex-wrap">
                CungaCash AI
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Finance only</Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time analysis of your income, expenses and net balance — plus finance & economy guidance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Mini label="Income" value={`${fmt(snapshot.totals.income)} RWF`} tone="income" icon={TrendingUp} />
            <Mini label="Expense" value={`${fmt(snapshot.totals.expense)} RWF`} tone="expense" icon={TrendingDown} />
            <Mini label="Net balance" value={`${fmt(net)} RWF`} tone={net >= 0 ? 'income' : 'expense'} icon={Wallet} />
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            Answers are limited to finance and economics, grounded in {snapshot.totals.records} of your records.
          </p>
        </CardContent>
      </Card>

      {/* Conversation */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Start with</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left text-sm rounded-lg border p-3 hover:bg-muted/60 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[55dvh] overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`rounded-2xl px-3.5 py-2.5 max-w-[92%] sm:max-w-[80%] text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {m.role === 'assistant' ? (
                      m.content
                        ? <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_*]:text-inherit">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        : <span className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing your finances…
                          </span>
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}

          <div className="flex items-end gap-2 pt-1">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask about your cash flow, budgets, savings, loans, inflation…"
              rows={2}
              className="resize-none min-h-[46px]"
            />
            <Button onClick={() => send(input)} disabled={streaming || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
            </Button>
          </div>

          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="gap-2 text-muted-foreground">
              <RotateCcw className="w-3.5 h-3.5" /> New conversation
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value, tone, icon: Icon }: { label: string; value: string; tone: 'income' | 'expense'; icon: any }) {
  const cls = tone === 'income' ? 'text-income' : 'text-expense';
  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${cls}`} />
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      </div>
      <p className={`text-sm font-bold mt-0.5 truncate ${cls}`}>{value}</p>
    </div>
  );
}
