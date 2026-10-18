// libs/runtime/server-bytes.ts — integers go into the response as bytes, two digits per lookup.
// `String(n)` would allocate a string AND fill V8's number-string cache. This writes exactly what
// String(value) would, straight into the output slab.

// Two decimal digits per lookup.
const DIGIT_PAIRS = new Uint8Array(200);
for (let n = 0; n < 100; n++) {
  DIGIT_PAIRS[n * 2] = 48 + Math.trunc(n / 10);
  DIGIT_PAIRS[n * 2 + 1] = 48 + (n % 10);
}
/** Room an integer needs: a safe integer has at most 16 digits plus a sign. */
export const INTEGER_BYTES = 17;

/** Writes an int32 as ASCII digits (exactly String(value)) at `offset`; returns the end offset. */
export function putInt32(bytes: Uint8Array, offset: number, value: number): number {
  let n = value;
  if (n < 0) {
    bytes[offset++] = 45;
    n = -n;
  }
  const digits = n < 1e8 ? (n < 1e4 ? (n < 1e2 ? (n < 1e1 ? 1 : 2) : n < 1e3 ? 3 : 4) : n < 1e6 ? (n < 1e5 ? 5 : 6) : n < 1e7 ? 7 : 8) : n < 1e9 ? 9 : 10;
  let index = offset + digits;
  while (n >= 100) {
    const pair = n % 100;
    index -= 2;
    bytes[index] = DIGIT_PAIRS[pair * 2]!;
    bytes[index + 1] = DIGIT_PAIRS[pair * 2 + 1]!;
    n = (n - pair) / 100;
  }
  if (n < 10) bytes[offset] = 48 + n;
  else {
    bytes[offset] = DIGIT_PAIRS[n * 2]!;
    bytes[offset + 1] = DIGIT_PAIRS[n * 2 + 1]!;
  }
  return offset + digits;
}
