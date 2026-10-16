// CSP nonces: the one generator behind the node and fetch adapters (Web Crypto, every runtime).

// 16 fresh CSPRNG bytes per nonce, cut from a pooled 4 KiB `getRandomValues` fill (every byte used once; the pool
// refills when it runs out) and base64-encoded by table: one `getRandomValues` + `btoa(String.fromCharCode(…))`
// per request cost ~0.8 µs, this ~0.1 µs.
const POOL = 4096;
const pool = new Uint8Array(POOL);
let at = POOL;
const DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Fresh 128-bit CSP nonce (base64) for one response's inline scripts. */
export function nonce(): string {
  if (at + 16 > POOL) {
    crypto.getRandomValues(pool);
    at = 0;
  }
  let out = "";
  // 5 groups of 3 bytes → 20 digits, then the 16th byte → 2 digits + "==".
  for (let end = at + 15; at < end; at += 3) {
    const n = (pool[at]! << 16) | (pool[at + 1]! << 8) | pool[at + 2]!;
    out += DIGITS[n >> 18]! + DIGITS[(n >> 12) & 63]! + DIGITS[(n >> 6) & 63]! + DIGITS[n & 63]!;
  }
  const last = pool[at++]!;
  return out + DIGITS[last >> 2]! + DIGITS[(last & 3) << 4]! + "==";
}
