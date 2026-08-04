/**
 * Fetch every row from a Supabase query builder, bypassing the 1,000-row
 * PostgREST cap by paging with .range(). Used for endless transactions,
 * endless alerts and endless notification history.
 *
 * Pages after the first are requested in parallel batches so large histories
 * load in a fraction of the time a sequential walk would take.
 */
const PAGE = 1000;
const CONCURRENCY = 4;
const MAX_ROWS = 500_000;

export async function fetchAllRows<T = any>(
  build: () => any,
  pageSize = PAGE,
): Promise<T[]> {
  const page = async (index: number): Promise<T[]> => {
    const from = index * pageSize;
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    return (data ?? []) as T[];
  };

  const first = await page(0);
  if (first.length < pageSize) return first;

  const out: T[] = [...first];
  let next = 1;
  for (;;) {
    const batch = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => page(next + i)),
    );
    let done = false;
    for (const rows of batch) {
      out.push(...rows);
      if (rows.length < pageSize) done = true;
    }
    next += CONCURRENCY;
    if (done || out.length >= MAX_ROWS) break;
  }
  return out;
}
