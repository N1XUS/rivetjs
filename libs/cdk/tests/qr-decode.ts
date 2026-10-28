// Test-only QR decoder for `@rivetjs/cdk/qr-code` suites. Written independently of the encoder (ISO/IEC 18004 reading
// order, own GF(256) log tables, own BCH check, ISO alignment table): reads a module matrix, finds the format by minimum
// Hamming distance over all 32 codes, unmasks, reads the zigzag, de-interleaves, corrects errors per block
// (Berlekamp–Massey + Chien + Forney) and parses numeric / alphanumeric / byte segments. Only the block table
// (count / ECC length per version + level) comes from the encoder module (`blockLayout`), pinned separately against ISO
// values in the tests.
import { blockLayout } from "../qr-code/index.tsx";
import type { QrEcc } from "../qr-code/index.tsx";

// prettier-ignore
export const ISO_ALIGNMENT: readonly (readonly number[])[] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
  [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82],
  [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

/* GF(256), primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D), via log / antilog tables. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}
const gmul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!);
const gdiv = (a: number, b: number): number => {
  if (b === 0) throw new Error("div0");
  return a === 0 ? 0 : EXP[(LOG[a]! + 255 - LOG[b]!) % 255]!;
};
const gpow = (e: number): number => EXP[((e % 255) + 255) % 255]!;
/** Evaluates a polynomial given low → high coefficients. */
const evalLow = (p: readonly number[], x: number): number => {
  let r = 0;
  for (let i = p.length - 1; i >= 0; i--) r = gmul(r, x) ^ p[i]!;
  return r;
};

/** Syndromes of a block (byte 0 = highest degree), roots α^0 … α^(n-1). */
export const syndromes = (block: readonly number[], n: number): number[] => {
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    const a = gpow(j);
    let r = 0;
    for (const c of block) r = gmul(r, a) ^ c;
    out.push(r);
  }
  return out;
};

/** Corrects up to n / 2 byte errors in place; returns the number corrected, throws when uncorrectable. */
export const rsCorrect = (block: number[], n: number): number => {
  const S = syndromes(block, n);
  if (S.every((s) => s === 0)) return 0;
  // Berlekamp–Massey
  let C: number[] = [1];
  let B: number[] = [1];
  let L = 0;
  let m = 1;
  let b = 1;
  for (let k = 0; k < n; k++) {
    let d = S[k]!;
    for (let i = 1; i <= L; i++) d ^= gmul(C[i] ?? 0, S[k - i]!);
    if (d === 0) {
      m++;
      continue;
    }
    const coef = gdiv(d, b);
    const next = C.slice();
    for (let i = 0; i < B.length; i++) {
      while (next.length <= i + m) next.push(0);
      next[i + m]! ^= gmul(coef, B[i]!);
    }
    if (2 * L <= k) {
      B = C;
      L = k + 1 - L;
      b = d;
      m = 1;
    } else m++;
    C = next;
  }
  // Chien search over positions p (degree p ↔ byte index N - 1 - p)
  const N = block.length;
  const positions: number[] = [];
  for (let p = 0; p < N; p++) if (evalLow(C, gpow(-p)) === 0) positions.push(p);
  if (positions.length !== L) throw new Error(`uncorrectable: ${L} errors, ${positions.length} roots`);
  // Forney (first consecutive root 0): e = X · Ω(X⁻¹) / Λ'(X⁻¹)
  const omega: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < C.length && i + j < n; j++) omega[i + j]! ^= gmul(S[i]!, C[j]!);
  const deriv: number[] = [];
  for (let i = 1; i < C.length; i++) deriv.push(i % 2 === 1 ? C[i]! : 0);
  for (const p of positions) {
    const X = gpow(p);
    const Xinv = gpow(-p);
    const e = gmul(X, gdiv(evalLow(omega, Xinv), evalLow(deriv, Xinv)));
    block[N - 1 - p]! ^= e;
  }
  if (!syndromes(block, n).every((s) => s === 0)) throw new Error("correction failed");
  return L;
};

/** BCH(15,5) code of 5 data bits, computed by long division by x^10 + x^8 + x^5 + x^4 + x^2 + x + 1, then masked. */
const formatCode = (data5: number): number => {
  let v = data5 << 10;
  for (let i = 14; i >= 10; i--) if ((v >>> i) & 1) v ^= 0b10100110111 << (i - 10);
  return ((data5 << 10) | v) ^ 0b101010000010010;
};
const popcount = (v: number): number => {
  let c = 0;
  for (; v; v &= v - 1) c++;
  return c;
};
const ECC_BY_FORMAT: Record<number, QrEcc> = { 1: "L", 0: "M", 3: "Q", 2: "H" };

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (y + x) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (y + x) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((y * x) % 2) + ((y * x) % 3) === 0,
  (x, y) => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
  (x, y) => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
];

/** Function-module map built from ISO 18004 layout rules (not the encoder's drawing code). */
export const isoFunctionMap = (version: number): Uint8Array => {
  const size = version * 4 + 17;
  const f = new Uint8Array(size * size);
  const mark = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < size && y < size) f[y * size + x] = 1;
  };
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) mark(x, y); // top-left finder + separator + format
  for (let y = 0; y < 9; y++) for (let x = size - 8; x < size; x++) mark(x, y); // top-right + format row
  for (let y = size - 8; y < size; y++) for (let x = 0; x < 9; x++) mark(x, y); // bottom-left + format column + dark
  for (let i = 0; i < size; i++) {
    mark(6, i);
    mark(i, 6);
  }
  const pos = ISO_ALIGNMENT[version]!;
  for (const cy of pos) {
    for (const cx of pos) {
      if ((cx < 9 && cy < 9) || (cx > size - 9 && cy < 9) || (cx < 9 && cy > size - 9)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(cx + dx, cy + dy);
    }
  }
  if (version >= 7) {
    for (let y = 0; y < 6; y++) for (let x = size - 11; x < size - 8; x++) mark(x, y);
    for (let y = size - 11; y < size - 8; y++) for (let x = 0; x < 6; x++) mark(x, y);
  }
  return f;
};

export interface Decoded {
  text: string;
  version: number;
  ecc: QrEcc;
  mask: number;
  /** Byte errors corrected over all blocks. */
  corrected: number;
}

const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/** Decodes a row-major module matrix (`1` = dark). */
export const decodeQr = (modules: ArrayLike<number>, size: number): Decoded => {
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) throw new Error("bad size");
  const at = (x: number, y: number): number => (modules[y * size + x] ? 1 : 0);
  // Format: first copy, bit 14 (MSB) … bit 0
  let fmt = 0;
  const seq1: [number, number][] = [];
  for (let x = 0; x <= 5; x++) seq1.push([x, 8]);
  seq1.push([7, 8], [8, 8], [8, 7]);
  for (let y = 5; y >= 0; y--) seq1.push([8, y]);
  for (const [x, y] of seq1) fmt = (fmt << 1) | at(x, y);
  let best = -1;
  let bestDist = 99;
  for (let d = 0; d < 32; d++) {
    const dist = popcount(formatCode(d) ^ fmt);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  if (bestDist > 3) throw new Error("format unreadable");
  const ecc = ECC_BY_FORMAT[best >>> 3]!;
  const mask = best & 7;
  const fn = isoFunctionMap(version);
  // Zigzag read
  const bits: number[] = [];
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let k = 0; k < size; k++) {
      const y = upward ? size - 1 - k : k;
      for (const x of [col, col - 1]) {
        if (fn[y * size + x]) continue;
        bits.push(at(x, y) ^ (MASKS[mask]!(x, y) ? 1 : 0));
      }
    }
    upward = !upward;
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]!;
    bytes.push(v);
  }
  // De-interleave
  const [numBlocks, eccLen] = blockLayout(version, ecc);
  const total = bytes.length;
  const shortLen = Math.floor(total / numBlocks);
  const numLong = total % numBlocks;
  const numShort = numBlocks - numLong;
  const dataShort = shortLen - eccLen;
  const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
  let k = 0;
  for (let i = 0; i < dataShort + 1; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i === dataShort && b < numShort) continue;
      blocks[b]!.push(bytes[k++]!);
    }
  }
  for (let i = 0; i < eccLen; i++) for (let b = 0; b < numBlocks; b++) blocks[b]!.push(bytes[k++]!);
  let corrected = 0;
  const data: number[] = [];
  for (const block of blocks) {
    corrected += rsCorrect(block, eccLen);
    data.push(...block.slice(0, block.length - eccLen));
  }
  // Segments
  let p = 0;
  const read = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = data[(p + i) >>> 3] ?? 0;
      v = (v << 1) | ((byte >>> (7 - ((p + i) & 7))) & 1);
    }
    p += n;
    return v;
  };
  const range = version < 10 ? 0 : version < 27 ? 1 : 2;
  const out: number[] = [];
  let text = "";
  const flush = (): void => {
    if (out.length) text += new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(out));
    out.length = 0;
  };
  while (p + 4 <= data.length * 8) {
    const mode = read(4);
    if (mode === 0) break;
    if (mode === 1) {
      flush();
      let count = read([10, 12, 14][range]!);
      for (; count >= 3; count -= 3) text += String(read(10)).padStart(3, "0");
      if (count === 2) text += String(read(7)).padStart(2, "0");
      else if (count === 1) text += String(read(4));
    } else if (mode === 2) {
      flush();
      let count = read([9, 11, 13][range]!);
      for (; count >= 2; count -= 2) {
        const v = read(11);
        text += ALNUM[Math.floor(v / 45)]! + ALNUM[v % 45]!;
      }
      if (count === 1) text += ALNUM[read(6)]!;
    } else if (mode === 4) {
      const count = read([8, 16, 16][range]!);
      for (let i = 0; i < count; i++) out.push(read(8));
    } else throw new Error(`unsupported mode ${mode}`);
  }
  flush();
  return { text, version, ecc, mask, corrected };
};
