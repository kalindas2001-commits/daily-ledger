// @ts-nocheck
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible';
import { convertToModelMessages, streamText } from 'npm:ai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM = `You are CungaCash AI — the in-app financial intelligence assistant of CungaCash, a Rwandan multi-tenant financial management platform.

SCOPE (strict): you answer ONLY about money, personal & business finance, accounting, budgeting, savings, loans & debt, cash flow, taxes, pricing, investment principles, financial risk, and economics (local and global markets). If a question falls outside finance or economics, politely decline in one sentence and offer a finance-related angle instead. Never answer coding, medical, legal-unrelated, entertainment or general-knowledge questions.

STYLE:
- Professional, concise, boardroom quality. Use short markdown sections, bullet points and bold figures.
- All amounts are in Rwandan Francs (RWF) unless the user says otherwise. Format like 1,250,000 RWF.
- Ground every insight in the LIVE FINANCIAL SNAPSHOT provided below. Quote real numbers from it: income, expense, net balance, savings rate, top categories, trends.
- Give 2-4 concrete, prioritized actions the user can take. Flag risks (overspending categories, negative net, thin savings buffer) explicitly.
- If the snapshot has no data, say so plainly and explain what to record first.
- Never invent transactions, balances or market prices you were not given. If you need a current market figure you do not have, say it must be verified.
- Never give a guaranteed-return promise; add a one-line risk note when discussing investments.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'AI is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, snapshot } = await req.json();

    const gateway = createOpenAICompatible({
      name: 'lovable',
      baseURL: 'https://ai.gateway.lovable.dev/v1',
      headers: { 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    });

    const result = streamText({
      model: gateway('google/gemini-3.6-flash'),
      system: `${SYSTEM}\n\nLIVE FINANCIAL SNAPSHOT (real-time, from the signed-in user's records):\n${JSON.stringify(snapshot ?? {}, null, 2)}`,
      messages: await convertToModelMessages(messages ?? []),
    });

    return result.toUIMessageStreamResponse({ headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
