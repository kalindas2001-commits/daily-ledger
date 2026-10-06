// Offline answer engine used when the AI service is unavailable (e.g. no credits).
// Answers common finance questions directly from the user's live snapshot.

const f = (n: number) => `**${Math.round(Number(n) || 0).toLocaleString('en-RW')} RWF**`;

const has = (q: string, words: string[]) => words.some(w => q.includes(w));

export function fallbackAnswer(question: string, s: any): string {
  const q = question.toLowerCase();
  const t = s?.totals ?? { income: 0, expense: 0, net_balance: 0, records: 0 };
  const note = '\n\n_Quick answer from your records — full AI analysis is paused right now._';

  if (!t.records) {
    return `### No records yet\nI don't see any transactions. Start by recording your income and your main daily expenses — after a week I can show your cash flow, top spending and savings capacity.${note}`;
  }

  const months: any[] = s.last_6_months ?? [];
  const avgExp = Number(s.avg_monthly_expense ?? 0);
  const avgInc = months.length ? months.reduce((a, m) => a + m.income, 0) / months.length : 0;
  const cats: any[] = s.top_expense_categories ?? [];
  const budgets: any[] = s.budgets ?? [];
  const over = budgets.filter(b => b.used_pct >= 100);
  const near = budgets.filter(b => b.used_pct >= 80 && b.used_pct < 100);

  const sections: string[] = [];

  const cashflow = () => {
    const last = months[months.length - 1];
    sections.push(`### Cash flow\n- Total income: ${f(t.income)}\n- Total expenses: ${f(t.expense)}\n- Net balance: ${f(t.net_balance)}\n- Savings rate: **${s.savings_rate_pct ?? 0}%**${last ? `\n- This month (${last.month}): ${f(last.income)} in, ${f(last.expense)} out, net ${f(last.net)}` : ''}`);
    if (t.net_balance < 0) sections.push(`**Risk:** you are spending more than you earn. Cut the top category below first.`);
  };
  const spending = () => {
    if (!cats.length) return;
    const total = cats.reduce((a, c) => a + c.amount, 0) || 1;
    sections.push(`### Where your money goes\n${cats.slice(0, 5).map((c, i) => `${i + 1}. ${c.category}: ${f(c.amount)} (${Math.round(c.amount / total * 100)}%)`).join('\n')}\n\n**Action:** reducing **${cats[0].category}** by 15% saves about ${f(cats[0].amount * 0.15)} over the same period.`);
  };
  const saving = () => {
    const target6 = avgExp * 6;
    const have = Number(s.accounts_total_balance ?? 0) + Number(s.savings?.total_balance ?? 0);
    const gap = Math.max(0, target6 - have);
    sections.push(`### Savings & safety buffer\n- Average monthly expense: ${f(avgExp)}\n- 6‑month safety target: ${f(target6)}\n- Current savings + accounts: ${f(have)}${s.emergency_fund_months != null ? ` (≈ **${s.emergency_fund_months} months** covered)` : ''}\n- Gap: ${f(gap)}${gap > 0 ? `\n\n**Action:** saving ${f(gap / 12)} per month closes the gap in 12 months${avgInc ? ` (${Math.round(gap / 12 / avgInc * 100)}% of average income)` : ''}.` : '\n\nYour buffer is healthy — keep it in a separate savings account.'}`);
  };
  const budgetsSec = () => {
    if (!budgets.length) { sections.push(`### Budgets\nYou have no budgets set. Add monthly limits for your top 3 categories.`); return; }
    sections.push(`### Budgets this month\n${budgets.map(b => `- ${b.category}: ${f(b.spent_this_month)} of ${f(b.monthly_limit)} (**${b.used_pct}%**)`).join('\n')}${over.length ? `\n\n**Over budget:** ${over.map(b => b.category).join(', ')}.` : ''}${near.length ? `\n**Close to limit:** ${near.map(b => b.category).join(', ')}.` : ''}`);
  };
  const loansSec = () => {
    const l = s.loans ?? {};
    sections.push(`### Loans\n- Owed to you (pending): ${f(l.owed_to_me_pending)}\n- You owe (pending): ${f(l.i_owe_pending)}${l.i_owe_pending > 0 && avgInc ? `\n\nYour debt equals **${(l.i_owe_pending / avgInc).toFixed(1)} months** of average income. Pay the oldest loan first.` : ''}`);
  };
  const goalsSec = () => {
    const g: any[] = s.goals ?? [];
    if (!g.length) { sections.push(`### Goals\nNo goals yet. Create one with a target amount and date to track progress.`); return; }
    sections.push(`### Goals\n${g.map(x => `- ${x.name}: ${f(x.saved)} of ${f(x.target)} (**${x.progress_pct}%**)${x.target_date ? ` · by ${x.target_date}` : ''}`).join('\n')}`);
  };
  const accountsSec = () => {
    const a: any[] = s.accounts ?? [];
    sections.push(`### Accounts\n${a.length ? a.filter(x => !x.archived).map(x => `- ${x.name}: ${f(x.balance)}`).join('\n') : 'No accounts added yet.'}\n- Total: ${f(s.accounts_total_balance)}`);
  };

  let matched = false;
  const run = (cond: boolean, fn: () => void) => { if (cond) { fn(); matched = true; } };
  run(has(q, ['cash', 'flow', 'income', 'net', 'balance', 'earn', 'losing', 'analy', 'overview', 'summary']), cashflow);
  run(has(q, ['categor', 'spend', 'expense', 'cut', 'losing', 'reduce']), spending);
  run(has(q, ['sav', 'emergency', 'safe', 'buffer', 'month']), saving);
  run(has(q, ['budget', 'limit']), budgetsSec);
  run(has(q, ['loan', 'debt', 'owe', 'borrow', 'lend']), loansSec);
  run(has(q, ['goal', 'target']), goalsSec);
  run(has(q, ['account', 'wallet', 'bank', 'momo']), accountsSec);

  if (has(q, ['inflation', 'economy', 'interest', 'invest', 'market', 'exchange', 'rate'])) {
    matched = true;
    sections.push(`### Economy note\nLive market and inflation figures need the full AI service and must be verified with the National Bank of Rwanda. General rule: if inflation is higher than your savings interest, your money loses value — keep only your safety buffer in cash and review fixed‑deposit or treasury options. _Investments carry risk; returns are never guaranteed._`);
  }

  if (!matched) { cashflow(); spending(); saving(); }
  return sections.join('\n\n') + note;
}
