import { readFileSync } from "node:fs";
import path from "node:path";

/** Every e2e account has a username starting with this, so cleanup can never touch a real account. */
export const E2E_PREFIX = "zz_e2e_";

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.join(process.cwd(), ".env.local");
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
  return out;
}

/** Delete all e2e accounts (cascades to their profiles, routines, sessions, sets, ...). Returns how many. */
export async function deleteE2EUsers(): Promise<number> {
  const e = env();
  const ref = e.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const token = e.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) throw new Error("SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL missing in .env.local");

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "gymbuddy-e2e/1.0" },
    body: JSON.stringify({
      query: `WITH d AS (DELETE FROM auth.users WHERE email LIKE '${E2E_PREFIX}%@gymbuddy.local' RETURNING 1) SELECT count(*)::int AS n FROM d;`,
    }),
  });
  if (!res.ok) throw new Error(`cleanup failed: HTTP ${res.status}`);
  const rows = (await res.json()) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}
