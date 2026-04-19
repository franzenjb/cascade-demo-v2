/**
 * Lightweight Supabase REST client.
 *
 * Uses direct fetch() against the PostgREST endpoint rather than
 * @supabase/supabase-js, to keep the bundle small and avoid a dependency
 * just for read-only public-table queries.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://qoskpyfgimjcmmxunfji.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

interface QueryOptions {
  select?: string;
  filters?: Record<string, string>;
  limit?: number;
  order?: string;
}

export async function sbSelect<T = Record<string, unknown>>(
  table: string,
  opts: QueryOptions = {}
): Promise<T[]> {
  if (!SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY is not set. Add it to .env.local.");
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", opts.select || "*");
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));
  if (opts.order) url.searchParams.set("order", opts.order);
  if (opts.filters) {
    for (const [key, value] of Object.entries(opts.filters)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${table} ${res.status}: ${body}`);
  }

  return (await res.json()) as T[];
}

export async function sbFetchAll<T = Record<string, unknown>>(
  table: string,
  opts: QueryOptions = {},
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("select", opts.select || "*");
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    if (opts.order) url.searchParams.set("order", opts.order);
    if (opts.filters) {
      for (const [key, value] of Object.entries(opts.filters)) {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase ${table} ${res.status}: ${body}`);
    }

    const page = (await res.json()) as T[];
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
