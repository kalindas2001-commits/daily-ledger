// @ts-nocheck
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'X-Lovable-AIG-Run-ID',
};

const SYSTEM = `You are CungaCash AI — the in-app financial intelligence assistant of CungaCash, a Rwandan multi-tenant financial management platform.

SCOPE (strict): you answer ONLY about money, personal & business finance, accounting, budgeting, savings, loans & debt, cash flow, taxes, pricing, investment principles, financial risk, and economics (local and global markets). If a question falls outside finance or economics, politely decline in one sentence and offer a finance-related angle instead.

STYLE:
- Professional, concise. Use short markdown sections, bullet points and bold figures.
- All amounts are in Rwandan Francs (RWF) unless the user says otherwise. Format like 1,250,000 RWF.
- Ground every insight in the LIVE FINANCIAL SNAPSHOT below and use the WHOLE snapshot: accounts, savings, budgets vs spend, goals, loans, emergency-fund months, monthly trends, top categories and recent transactions.
- Give 2-4 concrete, prioritized actions. Flag risks explicitly.
- If the snapshot has no data, say so and explain what to record first.
- Never invent transactions, balances or market prices. Never promise returns; add a one-line risk note on investments.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json(500, { error: 'AI is not configured' });

    const { messages, snapshot } = await req.json();
    const input = (messages ?? [])
      .filter((m: any) => m?.content && (m.role === 'user' || m.role === 'assistant'))
      .map((m: any) => ({ role: m.role, content: String(m.content) }));

    const upstream = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      signal: req.signal,
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        instructions: `${SYSTEM}\n\nLIVE FINANCIAL SNAPSHOT:\n${JSON.stringify(snapshot ?? {})}`,
        input,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      let message = 'CungaCash AI could not answer. Please try again.';
      try { message = JSON.parse(text)?.error?.message ?? JSON.parse(text)?.message ?? message; } catch { /* ignore */ }
      console.error('gateway error', upstream.status, text.slice(0, 500));
      return json(upstream.status, { error: message });
    }

    const runId = upstream.headers.get('X-Lovable-AIG-Run-ID');
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        let buf = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 1);
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const ev = JSON.parse(data);
                if (ev.type === 'response.output_text.delta' && ev.delta) {
                  controller.enqueue(encoder.encode(ev.delta));
                } else if (ev.type === 'response.failed' || ev.type === 'error') {
                  controller.enqueue(encoder.encode('\n\n_CungaCash AI stopped unexpectedly. Please try again._'));
                }
              } catch { /* partial */ }
            }
          }
        } catch (e) {
          console.error('stream error', e);
        } finally {
          controller.close();
        }
      },
      cancel() { reader.cancel().catch(() => {}); },
    });

    const headers: Record<string, string> = { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' };
    if (runId) headers['X-Lovable-AIG-Run-ID'] = runId;
    return new Response(stream, { headers });
  } catch (e: any) {
    if (e?.name === 'AbortError') return new Response(null, { status: 499, headers: corsHeaders });
    return json(500, { error: String(e?.message ?? e) });
  }
});
