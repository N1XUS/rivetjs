// UTF-8 byte encoders shared by NodeStreamWriter and the renderer's raw-slab row path. putText / putAttribute
// stay two specialized loops: one table-driven encoder measured 5-10% slower (SRV-SIMPLIFY 2026-10-07).

import { TEXT_SPECIAL } from "./escape.ts";

/** Clean strings longer than this go through the native UTF-8 writer (regex test + one call beats the per-char loop). */
const NATIVE_TEXT = 16;

// Two decimal digits per lookup.
const DIGIT_PAIRS = new Uint8Array(200);
for (let n = 0; n < 100; n++) {
  DIGIT_PAIRS[n * 2] = 48 + Math.trunc(n / 10);
  DIGIT_PAIRS[n * 2 + 1] = 48 + (n % 10);
}
/** Room an integer needs: a safe integer has at most 16 digits plus a sign. */
export const INTEGER_BYTES = 17;
/** Room per UTF-16 code unit of escaped text: `&` → `&amp;` (5 bytes); any other unit encodes to ≤ 3 bytes. */
export const TEXT_UNIT_BYTES = 5;

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

/** Writes a safe integer as ASCII digits (exactly String(value)): int32 through putInt32, larger ones by hand. */
export function putSafeInteger(bytes: Uint8Array, offset: number, value: number): number {
  if ((value | 0) === value) return putInt32(bytes, offset, value);
  const digits = "" + value;
  for (let d = 0; d < digits.length; d++) bytes[offset++] = digits.charCodeAt(d);
  return offset;
}

/**
 * Writes `text` HTML-text-escaped (`&` `<` `>`, exactly escapeText) as UTF-8 at `offset`; returns the end
 * offset. Lone surrogates become U+FFFD, as the native encoders write them. Needs `text.length * 5` bytes.
 */
export function putText(bytes: Uint8Array, offset: number, text: string): number {
  const length = text.length;
  if (length > NATIVE_TEXT) {
    const native = (bytes as Uint8Array & { utf8Write?: (chunk: string, offset: number, length: number) => number }).utf8Write;
    // Explicit length: workerd's (nodejs_compat) Buffer#utf8Write throws ERR_OUT_OF_RANGE without it.
    if (native !== undefined && !TEXT_SPECIAL.test(text)) return offset + native.call(bytes, text, offset, bytes.length - offset);
  }
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      if (code > 62 || (code !== 38 && code !== 60 && code !== 62)) bytes[offset++] = code;
      else {
        // &amp; &lt; &gt;
        bytes[offset] = 38;
        if (code === 38) {
          bytes[offset + 1] = 97;
          bytes[offset + 2] = 109;
          bytes[offset + 3] = 112;
          bytes[offset + 4] = 59;
          offset += 5;
        } else {
          bytes[offset + 1] = code === 60 ? 108 : 103;
          bytes[offset + 2] = 116;
          bytes[offset + 3] = 59;
          offset += 4;
        }
      }
    } else if (code < 0x800) {
      bytes[offset] = 0xc0 | (code >> 6);
      bytes[offset + 1] = 0x80 | (code & 0x3f);
      offset += 2;
    } else if (code < 0xd800 || code > 0xdfff) {
      bytes[offset] = 0xe0 | (code >> 12);
      bytes[offset + 1] = 0x80 | ((code >> 6) & 0x3f);
      bytes[offset + 2] = 0x80 | (code & 0x3f);
      offset += 3;
    } else {
      const next = i + 1 < length ? text.charCodeAt(i + 1) : 0;
      if (code < 0xdc00 && next >= 0xdc00 && next <= 0xdfff) {
        const point = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        bytes[offset] = 0xf0 | (point >> 18);
        bytes[offset + 1] = 0x80 | ((point >> 12) & 0x3f);
        bytes[offset + 2] = 0x80 | ((point >> 6) & 0x3f);
        bytes[offset + 3] = 0x80 | (point & 0x3f);
        offset += 4;
        i++;
      } else {
        // Lone surrogate → U+FFFD.
        bytes[offset] = 0xef;
        bytes[offset + 1] = 0xbf;
        bytes[offset + 2] = 0xbd;
        offset += 3;
      }
    }
  }
  return offset;
}

/** Room per UTF-16 code unit of an escaped attribute value: `"` → `&quot;` (6 bytes). */
export const ATTRIBUTE_UNIT_BYTES = 6;

/**
 * Writes `text` attribute-escaped (`&` `<` `>` `"` `'`, exactly escapeAttribute) as UTF-8 at `offset`; returns
 * the end offset. Lone surrogates become U+FFFD. Needs `text.length * ATTRIBUTE_UNIT_BYTES` bytes.
 */
export function putAttribute(bytes: Uint8Array, offset: number, text: string): number {
  const length = text.length;
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      if (code > 62 || (code !== 34 && code !== 38 && code !== 39 && code !== 60 && code !== 62)) bytes[offset++] = code;
      else {
        bytes[offset] = 38;
        if (code === 34) {
          // &quot;
          bytes[offset + 1] = 113;
          bytes[offset + 2] = 117;
          bytes[offset + 3] = 111;
          bytes[offset + 4] = 116;
          bytes[offset + 5] = 59;
          offset += 6;
        } else if (code === 38) {
          // &amp;
          bytes[offset + 1] = 97;
          bytes[offset + 2] = 109;
          bytes[offset + 3] = 112;
          bytes[offset + 4] = 59;
          offset += 5;
        } else if (code === 39) {
          // &#39;
          bytes[offset + 1] = 35;
          bytes[offset + 2] = 51;
          bytes[offset + 3] = 57;
          bytes[offset + 4] = 59;
          offset += 5;
        } else {
          // &lt; &gt;
          bytes[offset + 1] = code === 60 ? 108 : 103;
          bytes[offset + 2] = 116;
          bytes[offset + 3] = 59;
          offset += 4;
        }
      }
    } else if (code < 0x800) {
      bytes[offset] = 0xc0 | (code >> 6);
      bytes[offset + 1] = 0x80 | (code & 0x3f);
      offset += 2;
    } else if (code < 0xd800 || code > 0xdfff) {
      bytes[offset] = 0xe0 | (code >> 12);
      bytes[offset + 1] = 0x80 | ((code >> 6) & 0x3f);
      bytes[offset + 2] = 0x80 | (code & 0x3f);
      offset += 3;
    } else {
      const next = i + 1 < length ? text.charCodeAt(i + 1) : 0;
      if (code < 0xdc00 && next >= 0xdc00 && next <= 0xdfff) {
        const point = ((code - 0xd800) << 10) + (next - 0xdc00) + 0x10000;
        bytes[offset] = 0xf0 | (point >> 18);
        bytes[offset + 1] = 0x80 | ((point >> 12) & 0x3f);
        bytes[offset + 2] = 0x80 | ((point >> 6) & 0x3f);
        bytes[offset + 3] = 0x80 | (point & 0x3f);
        offset += 4;
        i++;
      } else {
        bytes[offset] = 0xef;
        bytes[offset + 1] = 0xbf;
        bytes[offset + 2] = 0xbd;
        offset += 3;
      }
    }
  }
  return offset;
}
