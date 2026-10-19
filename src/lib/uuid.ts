/**
 * RFC 4122 v4 UUID that also works in an insecure context.
 *
 * `crypto.randomUUID()` only exists on HTTPS pages and `localhost`; opening the dev server from a phone via
 * its LAN address (http://192.168.x.x) leaves it undefined. `crypto.getRandomValues` is available everywhere,
 * so fall back to it. Client-generated ids make writes idempotent, so this must never throw.
 */
export function randomUUID(): string {
  const c: Crypto | undefined = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    // Last resort (very old WebView): not cryptographically strong, but ids only need to be unique, not secret.
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
