/**
 * Fetch every row from a Supabase query builder, bypassing the 1,000-row
 * PostgREST cap by paging with .range(). Used for endless transactions,
 * endless alerts and endless notification history.
 */
const PAGE = 1000;

export async function fetchAllRows<T = any>(
  build: () => any,
  pageSize = PAGE,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const from = page * pageSize;
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    // Hard safety valve: 500k rows
    if (out.length >= 500_000) break;
  }
  return out;
}
