import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "@/lib/uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Captured before any stubbing so the stubs can delegate to the real implementation.
const realCrypto = globalThis.crypto;

afterEach(() => vi.unstubAllGlobals());

describe("randomUUID", () => {
  it("uses crypto.randomUUID when available", () => {
    expect(randomUUID()).toMatch(V4);
  });

  it("falls back to getRandomValues in an insecure context (no crypto.randomUUID)", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 200 }, () => randomUUID()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
  });

  it("still returns a valid id with no crypto at all", () => {
    vi.stubGlobal("crypto", undefined);
    expect(randomUUID()).toMatch(V4);
  });

  it("sets the version and variant bits regardless of the random bytes", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(0xff) });
    expect(randomUUID()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(0x00) });
    expect(randomUUID()).toBe("00000000-0000-4000-8000-000000000000");
  });
});
