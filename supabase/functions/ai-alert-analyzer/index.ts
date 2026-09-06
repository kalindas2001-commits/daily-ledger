// Alert analyzer — runs per cron. Deterministic rule engine always produces alerts;
// Lovable AI adds one extra insight when credits are available (and never blocks the run).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Sev = 'info' | 'warning' | 'critical';
interface Draft { severity: Sev; category: string; title: string; message: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const { data: users } = await supa.from('profiles').select('user_id, tenant_id, full_name, email');

    let inserted = 0;
    let aiUsed = 0;
    // Once the gateway says "no credits" / "blocked", stop calling it for the rest of the run.
    let aiBlocked = !LOVABLE_API_KEY;
    let aiBlockReason: string | null = LOVABLE_API_KEY ? null : 'LOVABLE_API_KEY missing';

    const money = (n: number) => `${Math.round(n).toLocaleString('en-US')} RWF`;

    for (const u of users ?? []) {
      const [{ data: txs }, { data: monthTxs }, { data: loans }, { data: budgets }] = await Promise.all([
        supa.from('transactions').select('type,total_amount,category,description,created_at')
          .eq('user_id', u.user_id).gte('created_at', since),
        supa.from('transactions').select('type,total_amount,category')
          .eq('user_id', u.user_id).gte('transaction_date', monthStartStr),
        supa.from('loans').select('amount,status,type,loan_date').eq('user_id', u.user_id).eq('status', 'PENDING'),
        supa.from('budgets').select('category,monthly_limit,alert_threshold').eq('user_id', u.user_id),
      ]);

      const dayTx = txs ?? [];
      const monthList = monthTxs ?? [];
      const loanList = loans ?? [];
      if (dayTx.length === 0 && loanList.length === 0 && monthList.length === 0) continue;

      const income = dayTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
      const expense = dayTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
      const mIncome = monthList.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
      const mExpense = monthList.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
      const oweMe = loanList.filter(l => l.type === 'GIVEN').reduce((s, l) => s + Number(l.amount), 0);
      const iOwe = loanList.filter(l => l.type === 'RECEIVED').reduce((s, l) => s + Number(l.amount), 0);

      const drafts: Draft[] = [];

      // 1. Net negative day
      if (expense > income && expense > 0) {
        drafts.push({
          severity: expense > income * 2 ? 'critical' : 'warning',
          category: 'cashflow',
          title: 'Spending outpaced income today',
          message: `You spent ${money(expense)} against ${money(income)} income in the last 24h. Review the biggest line item before it repeats.`,
        });
      }

      // 2. Budget threshold breaches (month to date)
      const spendByCat: Record<string, number> = {};
      monthList.forEach(t => {
        if (t.type === 'EXPENSE') spendByCat[t.category] = (spendByCat[t.category] ?? 0) + Number(t.total_amount ?? 0);
      });
      for (const b of budgets ?? []) {
        const limit = Number(b.monthly_limit ?? 0);
        if (limit <= 0) continue;
        const spent = spendByCat[b.category] ?? 0;
        const pct = (spent / limit) * 100;
        const threshold = Number(b.alert_threshold ?? 80);
        if (pct >= threshold) {
          drafts.push({
            severity: pct >= 100 ? 'critical' : 'warning',
            category: 'budget',
            title: pct >= 100 ? `${b.category} budget exceeded` : `${b.category} budget at ${Math.round(pct)}%`,
            message: `${money(spent)} of ${money(limit)} used this month. ${pct >= 100 ? 'Pause non-essential spend in this category.' : 'Slow down to finish the month within plan.'}`,
          });
        }
      }

      // 3. Unusually large single expense vs monthly average
      const monthExpenses = monthList.filter(t => t.type === 'EXPENSE').map(t => Number(t.total_amount ?? 0));
      const avgExp = monthExpenses.length ? monthExpenses.reduce((a, b) => a + b, 0) / monthExpenses.length : 0;
      const bigToday = dayTx.filter(t => t.type === 'EXPENSE')
        .sort((a, b) => Number(b.total_amount ?? 0) - Number(a.total_amount ?? 0))[0];
      if (bigToday && avgExp > 0 && Number(bigToday.total_amount ?? 0) > avgExp * 3) {
        drafts.push({
          severity: 'warning',
          category: 'anomaly',
          title: 'Unusually large expense detected',
          message: `${bigToday.category} of ${money(Number(bigToday.total_amount ?? 0))} is over 3x your typical expense (${money(avgExp)}). Confirm it is intentional.`,
        });
      }

      // 4. Loan exposure
      if (oweMe > 0 && oweMe > mIncome * 0.3 && mIncome > 0) {
        drafts.push({
          severity: 'warning',
          category: 'loans',
          title: 'High receivable exposure',
          message: `${money(oweMe)} is still owed to you — that is ${Math.round((oweMe / mIncome) * 100)}% of this month's income. Follow up on the oldest debts.`,
        });
      }
      if (iOwe > 0) {
        drafts.push({
          severity: iOwe > mIncome * 0.5 ? 'critical' : 'info',
          category: 'loans',
          title: 'Outstanding debt reminder',
          message: `You owe ${money(iOwe)} across pending loans. Plan a repayment from this month's surplus.`,
        });
      }

      // 5. Positive reinforcement — healthy savings rate
      if (mIncome > 0 && mExpense < mIncome * 0.7 && monthList.length >= 3) {
        drafts.push({
          severity: 'info',
          category: 'savings',
          title: 'Strong savings rate this month',
          message: `You kept ${Math.round(((mIncome - mExpense) / mIncome) * 100)}% of income (${money(mIncome - mExpense)}). Consider moving part of it into a savings goal.`,
        });
      }

      if (drafts.length === 0) continue;

      // Optional AI enrichment — one extra forward-looking insight, best effort only.
      if (!aiBlocked) {
        try {
          const summary = `Last 24h: income ${income}, expense ${expense}, ${dayTx.length} transactions. Month to date: income ${mIncome}, expense ${mExpense}. Pending loans: receivable ${oweMe}, payable ${iOwe}. Top expense categories: ${Object.entries(spendByCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c}=${v}`).join(', ') || 'none'}.`;
          const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-3.6-flash',
              messages: [
                { role: 'system', content: 'You are a Rwandan finance analyst. Produce at most ONE short forward-looking alert (<=25 words) with a concrete action. Amounts in RWF. Reply ONLY with JSON {"skip":true} or {"severity":"info|warning|critical","title":"...","message":"...","category":"ai"}.' },
                { role: 'user', content: summary },
              ],
            }),
          });

          if (aiResp.status === 402 || aiResp.status === 403) {
            aiBlocked = true;
            aiBlockReason = `gateway ${aiResp.status}`;
            await aiResp.text();
          } else if (!aiResp.ok) {
            await aiResp.text();
          } else {
            const aiJson = await aiResp.json();
            const raw = aiJson.choices?.[0]?.message?.content ?? '{"skip":true}';
            const parsed = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
            if (!parsed.skip && parsed.title) {
              drafts.push({
                severity: ['info', 'warning', 'critical'].includes(parsed.severity) ? parsed.severity : 'info',
                category: 'ai',
                title: String(parsed.title).slice(0, 120),
                message: String(parsed.message ?? '').slice(0, 400),
              });
              aiUsed++;
            }
          }
        } catch (_e) {
          // AI is optional — deterministic alerts still go out.
        }
      }

      // Dedupe: skip a draft whose title already fired for this user in the last 12h.
      const twelveH = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data: recent } = await supa.from('alerts').select('title')
        .eq('user_id', u.user_id).gte('created_at', twelveH);
      const seen = new Set((recent ?? []).map((r: any) => r.title));

      const rows = drafts
        .filter(d => !seen.has(d.title))
        .slice(0, 4)
        .map(d => ({
          user_id: u.user_id,
          tenant_id: u.tenant_id,
          severity: d.severity,
          category: d.category,
          title: d.title.slice(0, 120),
          message: d.message.slice(0, 400),
        }));

      if (rows.length > 0) {
        const { error } = await supa.from('alerts').insert(rows);
        if (!error) inserted += rows.length;
        else console.error('insert failed', error.message);
      }
    }

    return new Response(JSON.stringify({
      ok: true, inserted, ai_insights: aiUsed, ai_blocked: aiBlocked, ai_block_reason: aiBlockReason,
      scanned: users?.length ?? 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('analyze error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
