/**
 * Auth errors that mean "the cookie in this browser can never work again" (the account or session was
 * deleted/rotated/expired server-side), as opposed to transient failures (network, rate limit, 5xx).
 * For these the right response is to drop the cookies and treat the visitor as signed out.
 */
const DEAD_SESSION_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
  "session_expired",
  "user_not_found",
  "bad_jwt",
]);

export function isDeadSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; status?: unknown; name?: unknown };
  if (typeof e.code === "string" && DEAD_SESSION_CODES.has(e.code)) return true;
  // Older GoTrue responses carry no code: a 4xx auth error on getUser/refresh is equally final.
  return e.name === "AuthApiError" && typeof e.status === "number" && e.status >= 400 && e.status < 500 && e.status !== 429;
}

/** Supabase stores the session in `sb-<project>-auth-token`, split into `.0`, `.1`, ... chunks when large. */
export function isAuthCookieName(name: string): boolean {
  return /^sb-.+-auth-token(\.\d+)?$/.test(name);
}
