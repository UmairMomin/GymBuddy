import { describe, expect, it } from "vitest";
import { isAuthCookieName, isDeadSessionError } from "@/lib/supabase/session-errors";

describe("isDeadSessionError", () => {
  it("treats a missing/used refresh token and deleted users as dead sessions", () => {
    expect(isDeadSessionError({ name: "AuthApiError", status: 400, code: "refresh_token_not_found" })).toBe(true);
    expect(isDeadSessionError({ name: "AuthApiError", status: 400, code: "refresh_token_already_used" })).toBe(true);
    expect(isDeadSessionError({ code: "user_not_found", status: 403 })).toBe(true);
    expect(isDeadSessionError({ code: "bad_jwt" })).toBe(true);
  });
  it("treats code-less 4xx auth errors as dead, but not rate limits", () => {
    expect(isDeadSessionError({ name: "AuthApiError", status: 401 })).toBe(true);
    expect(isDeadSessionError({ name: "AuthApiError", status: 429, code: "over_request_rate_limit" })).toBe(false);
  });
  it("keeps the session for transient failures", () => {
    expect(isDeadSessionError({ name: "AuthRetryableFetchError", status: 0 })).toBe(false);
    expect(isDeadSessionError({ name: "AuthApiError", status: 503 })).toBe(false);
    expect(isDeadSessionError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isDeadSessionError(null)).toBe(false);
    expect(isDeadSessionError("nope")).toBe(false);
  });
});

describe("isAuthCookieName", () => {
  it("matches the session cookie and its chunks only", () => {
    expect(isAuthCookieName("sb-riadyxvoboocweemdykb-auth-token")).toBe(true);
    expect(isAuthCookieName("sb-riadyxvoboocweemdykb-auth-token.0")).toBe(true);
    expect(isAuthCookieName("sb-riadyxvoboocweemdykb-auth-token.12")).toBe(true);
    expect(isAuthCookieName("sb-riadyxvoboocweemdykb-auth-token-code-verifier")).toBe(false);
    expect(isAuthCookieName("gt-install-dismissed")).toBe(false);
    expect(isAuthCookieName("theme")).toBe(false);
  });
});
