// AI alert analyzer — runs per cron, scans recent activity per tenant, inserts alerts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // Look at last 24h of activity per user (per admin/super_admin)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: users } = await supa.from('profiles').select('user_id, tenant_id, full_name, email');
    let inserted = 0;

    for (const u of users ?? []) {
      // Aggregate stats
      const [{ data: txs }, { data: loans }, { data: budgets }] = await Promise.all([
        supa.from('transactions').select('type,total_amount,category,transaction_date,created_at').eq('user_id', u.user_id).gte('created_at', since),
        supa.from('loans').select('amount,status,type,loan_date').eq('user_id', u.user_id).eq('status', 'PENDING'),
        supa.from('budgets').select('category,monthly_limit,alert_threshold').eq('user_id', u.user_id),
      ]);

      if ((!txs || txs.length === 0) && (!loans || loans.length === 0)) continue;

      const income = (txs ?? []).filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
      const expense = (txs ?? []).filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.total_amount ?? 0), 0);
      const oweMe = (loans ?? []).filter(l => l.type === 'GIVEN').reduce((s, l) => s + Number(l.amount), 0);
      const iOwe = (loans ?? []).filter(l => l.type === 'RECEIVED').reduce((s, l) => s + Number(l.amount), 0);

      const summary = `User ${u.full_name || u.email} — last 24h: income=${income} RWF, expense=${expense} RWF, ${txs?.length ?? 0} tx. Pending loans: people owe ${oweMe} RWF, you owe ${iOwe} RWF. Budgets: ${(budgets ?? []).length}.`;

      // Skip already-recent identical alerts (within 6h dedupe)
      const sixH = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: recent } = await supa.from('alerts').select('id').eq('user_id', u.user_id).gte('created_at', sixH).limit(5);
      if ((recent?.length ?? 0) >= 3) continue;

      // Call Lovable AI for an insight
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You generate at most ONE short financial alert (≤25 words) only if something noteworthy happened. Reply ONLY with JSON {"skip":true} or {"severity":"info|warning|critical","title":"...","message":"...","category":"..."}. No prose.' },
            { role: 'user', content: summary },
          ],
        }),
      });

      if (!aiResp.ok) { console.error('AI failed', await aiResp.text()); continue; }
      const aiJson = await aiResp.json();
      const raw = aiJson.choices?.[0]?.message?.content ?? '{"skip":true}';
      let parsed: any = { skip: true };
      try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { continue; }
      if (parsed.skip || !parsed.title) continue;

      const { error } = await supa.from('alerts').insert({
        user_id: u.user_id,
        tenant_id: u.tenant_id,
        severity: ['info', 'warning', 'critical'].includes(parsed.severity) ? parsed.severity : 'info',
        category: parsed.category ?? 'ai',
        title: String(parsed.title).slice(0, 120),
        message: String(parsed.message ?? '').slice(0, 400),
      });
      if (!error) inserted++;
    }

    return new Response(JSON.stringify({ ok: true, inserted, scanned: users?.length ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('analyze error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
