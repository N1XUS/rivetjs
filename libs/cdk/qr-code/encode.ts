// Ported from Project Nayuki "QR Code generator library" (TypeScript version, typescript-javascript/qrcodegen.ts), MIT,
// © Project Nayuki (https://www.nayuki.io/page/qr-code-generator-library).
// Rivet:
// - Classes (`QrCode`, `QrSegment`, `Ecc`, `Mode`) → plain functions over flat data: `encodeQr(text, options)` returns
//   `{ version, size, ecc, mask, modules, functions }` with `modules` / `functions` as row-major `Uint8Array`s
//   (`1` = dark / function module) instead of `boolean[][]` (one allocation, cheap to walk, serializable).
// - Same algorithm, tables and defaults as upstream: segment mode = numeric / alphanumeric / byte (UTF-8) per text
//   (`QrSegment.makeSegments`; no mixed-mode optimisation, as upstream's basic library), smallest version that fits
//   in `[minVersion, maxVersion]`, ECC boosted to the highest level that still fits (`boostEcc`, default `true`),
//   automatic mask = lowest ISO 18004 penalty (N1..N4, upstream's finder-like run history), RS ECC + block interleaving.
// - Not ported: ECI / kanji segments, `encodeBinary` (bytes go through `encodeQrSegments` + `makeBytes`), `getModule`
//   accessor (read `modules[y * size + x]`), `toSvgString` (geometry lives in `./paths.ts`).
// - Errors are `RangeError`s ("Data too long" upstream message kept).

/** Error correction level: recovers about 7 % (`L`), 15 % (`M`), 25 % (`Q`) or 30 % (`H`) of the codewords. */
export type QrEcc = "L" | "M" | "Q" | "H";

/** Segment mode (ISO 18004 8.4). */
export type QrMode = "numeric" | "alphanumeric" | "byte";

/** One data segment: mode, character count, payload bits (`0` / `1` per entry). */
export interface QrSegment {
  readonly mode: QrMode;
  readonly numChars: number;
  readonly bits: readonly number[];
}

export interface QrEncodeOptions {
  /** Error correction level (the minimum when `boostEcc`). @default "M" */
  ecc?: QrEcc;
  /** Smallest version (1–40) to try. @default 1 */
  minVersion?: number;
  /** Largest version (1–40) to try. @default 40 */
  maxVersion?: number;
  /** Mask pattern 0–7, or `-1` for the lowest-penalty mask. @default -1 */
  mask?: number;
  /** Raise the ECC level while the data still fits the chosen version. @default true */
  boostEcc?: boolean;
}

/** An encoded symbol. Module (x, y) is `modules[y * size + x]`. */
export interface QrMatrix {
  /** 1–40. */
  readonly version: number;
  /** Modules per side: `version * 4 + 17`. */
  readonly size: number;
  /** The level actually used (may be boosted above the requested one). */
  readonly ecc: QrEcc;
  /** 0–7. */
  readonly mask: number;
  /** Row-major, `1` = dark. */
  readonly modules: Uint8Array;
  /** Row-major, `1` = function pattern (finder + separator, timing, alignment, format, version, dark module). */
  readonly functions: Uint8Array;
}

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

/** ECC level ordinal (upstream `Ecc.ordinal`) and the 2-bit format field (`Ecc.formatBits`). */
const ECC_ORDINAL: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };
const ECC_ORDER: readonly QrEcc[] = ["L", "M", "Q", "H"];

/** Mode indicator bits + character count bits for versions 1–9 / 10–26 / 27–40. */
const MODE_BITS: Record<QrMode, number> = { numeric: 0x1, alphanumeric: 0x2, byte: 0x4 };
const CHAR_COUNT_BITS: Record<QrMode, readonly [number, number, number]> = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
};

const numCharCountBits = (mode: QrMode, version: number): number => CHAR_COUNT_BITS[mode][Math.floor((version + 7) / 17)]!;

// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  // Version: (index 0 is padding)
  //0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40
  [-1,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Low
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // Medium
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Quartile
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // High
];

// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  // Version: (index 0 is padding)
  //0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,  8,  9,  9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // Low
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // Medium
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Quartile
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // High
];

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const NUMERIC_REGEX = /^[0-9]*$/;
const ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/* -------------------------------------------------------------------------------------------------
 * Segments (upstream QrSegment)
 * -----------------------------------------------------------------------------------------------*/

const appendBits = (val: number, len: number, bb: number[]): void => {
  if (len < 0 || len > 31 || val >>> len !== 0) throw new RangeError("Value out of range");
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
};

/** UTF-8 bytes of `str` (upstream `toUtf8ByteArray`; lone surrogates → U+FFFD as `TextEncoder`). */
const utf8 = (str: string): number[] => Array.from(new TextEncoder().encode(str));

/** A byte-mode segment of `data` (0–255 each). */
export const makeBytes = (data: readonly number[]): QrSegment => {
  const bits: number[] = [];
  for (const b of data) appendBits(b, 8, bits);
  return { mode: "byte", numChars: data.length, bits };
};

/** A numeric-mode segment (digits only). */
export const makeNumeric = (digits: string): QrSegment => {
  if (!NUMERIC_REGEX.test(digits)) throw new RangeError("String contains non-numeric characters");
  const bits: number[] = [];
  for (let i = 0; i < digits.length;) {
    const n = Math.min(digits.length - i, 3);
    appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bits);
    i += n;
  }
  return { mode: "numeric", numChars: digits.length, bits };
};

/** An alphanumeric-mode segment (`0–9 A–Z space $ % * + - . / :`). */
export const makeAlphanumeric = (text: string): QrSegment => {
  if (!ALPHANUMERIC_REGEX.test(text)) throw new RangeError("String contains unencodable characters in alphanumeric mode");
  const bits: number[] = [];
  let i: number;
  for (i = 0; i + 2 <= text.length; i += 2) {
    let temp = ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
    temp += ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
    appendBits(temp, 11, bits);
  }
  if (i < text.length) appendBits(ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bits);
  return { mode: "alphanumeric", numChars: text.length, bits };
};

/** Upstream `QrSegment.makeSegments`: zero or one segment in the most compact single mode for `text`. */
export const makeSegments = (text: string): QrSegment[] => {
  if (text === "") return [];
  if (NUMERIC_REGEX.test(text)) return [makeNumeric(text)];
  if (ALPHANUMERIC_REGEX.test(text)) return [makeAlphanumeric(text)];
  return [makeBytes(utf8(text))];
};

/** Bits needed for `segs` at `version`, `Infinity` when a character count overflows its field. */
const totalBits = (segs: readonly QrSegment[], version: number): number => {
  let result = 0;
  for (const seg of segs) {
    const ccbits = numCharCountBits(seg.mode, version);
    if (seg.numChars >= 1 << ccbits) return Infinity;
    result += 4 + ccbits + seg.bits.length;
  }
  return result;
};

/* -------------------------------------------------------------------------------------------------
 * Capacity (upstream QrCode static helpers)
 * -----------------------------------------------------------------------------------------------*/

/** Data + ECC modules of `version` (everything but function patterns), including remainder bits. */
export const numRawDataModules = (version: number): number => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
};

/** 8-bit data codewords (ECC excluded) of `version` at `ecc`. */
export const numDataCodewords = (version: number, ecc: QrEcc): number => {
  const o = ECC_ORDINAL[ecc];
  return Math.floor(numRawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[o]![version]! * NUM_ERROR_CORRECTION_BLOCKS[o]![version]!;
};

/** Ascending centre coordinates of the alignment patterns of `version` (empty for version 1). */
export const alignmentPositions = (version: number): number[] => {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result: number[] = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
};

/* -------------------------------------------------------------------------------------------------
 * Reed–Solomon over GF(2^8 / 0x11D)
 * -----------------------------------------------------------------------------------------------*/

export const rsMultiply = (x: number, y: number): number => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};

/** Generator polynomial of `degree` (coefficients high → low, leading 1 omitted). */
export const rsDivisor = (degree: number): number[] => {
  if (degree < 1 || degree > 255) throw new RangeError("Degree out of range");
  const result: number[] = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j]!, root);
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!;
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
};

/** ECC codewords of `data` for `divisor`. */
export const rsRemainder = (data: readonly number[], divisor: readonly number[]): number[] => {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i]! ^= rsMultiply(divisor[i]!, factor);
  }
  return result;
};

/** Data codewords split into blocks, ECC appended per block, interleaved (upstream `addEccAndInterleave`). */
export const addEccAndInterleave = (data: readonly number[], version: number, ecc: QrEcc): number[] => {
  const o = ECC_ORDINAL[ecc];
  if (data.length !== numDataCodewords(version, ecc)) throw new RangeError("Invalid argument");
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[o]![version]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[o]![version]!;
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blocks: number[][] = [];
  const rsDiv = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat: number[] = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const eccWords = rsRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(eccWords));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      // Skip the padding byte in short blocks
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(blocks[j]![i]!);
    }
  }
  return result;
};

/** Per-version block structure (for decoders / tests): `[numBlocks, eccPerBlock]`. */
export const blockLayout = (version: number, ecc: QrEcc): [number, number] => {
  const o = ECC_ORDINAL[ecc];
  return [NUM_ERROR_CORRECTION_BLOCKS[o]![version]!, ECC_CODEWORDS_PER_BLOCK[o]![version]!];
};

/* -------------------------------------------------------------------------------------------------
 * BCH-coded format / version information
 * -----------------------------------------------------------------------------------------------*/

/** 15-bit format information (ECC level + mask, BCH(15,5), XOR 0x5412). */
export const formatBits = (ecc: QrEcc, mask: number): number => {
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
};

/** 18-bit version information (versions ≥ 7, BCH(18,6)). */
export const versionBits = (version: number): number => {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
};

const getBit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

/* -------------------------------------------------------------------------------------------------
 * Matrix construction (upstream QrCode constructor + draw* / applyMask / getPenaltyScore)
 * -----------------------------------------------------------------------------------------------*/

interface Grid {
  readonly size: number;
  readonly modules: Uint8Array;
  readonly functions: Uint8Array;
}

const setFunctionModule = (g: Grid, x: number, y: number, isDark: boolean): void => {
  g.modules[y * g.size + x] = isDark ? 1 : 0;
  g.functions[y * g.size + x] = 1;
};

const drawFormatBits = (g: Grid, ecc: QrEcc, mask: number): void => {
  const bits = formatBits(ecc, mask);
  const size = g.size;
  // First copy
  for (let i = 0; i <= 5; i++) setFunctionModule(g, 8, i, getBit(bits, i));
  setFunctionModule(g, 8, 7, getBit(bits, 6));
  setFunctionModule(g, 8, 8, getBit(bits, 7));
  setFunctionModule(g, 7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) setFunctionModule(g, 14 - i, 8, getBit(bits, i));
  // Second copy
  for (let i = 0; i < 8; i++) setFunctionModule(g, size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i++) setFunctionModule(g, 8, size - 15 + i, getBit(bits, i));
  setFunctionModule(g, 8, size - 8, true); // Always dark
};

const drawVersion = (g: Grid, version: number): void => {
  if (version < 7) return;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const color = getBit(bits, i);
    const a = g.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunctionModule(g, a, b, color);
    setFunctionModule(g, b, a, color);
  }
};

const drawFinderPattern = (g: Grid, x: number, y: number): void => {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev/infinity norm
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < g.size && yy >= 0 && yy < g.size) setFunctionModule(g, xx, yy, dist !== 2 && dist !== 4);
    }
  }
};

const drawAlignmentPattern = (g: Grid, x: number, y: number): void => {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) setFunctionModule(g, x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
};

/** Draws every function pattern of `version` (format bits as a dummy mask-0 placeholder, as upstream). */
export const drawFunctionPatterns = (version: number, ecc: QrEcc = "L"): Grid => {
  const size = version * 4 + 17;
  const g: Grid = { size, modules: new Uint8Array(size * size), functions: new Uint8Array(size * size) };
  // Timing patterns
  for (let i = 0; i < size; i++) {
    setFunctionModule(g, 6, i, i % 2 === 0);
    setFunctionModule(g, i, 6, i % 2 === 0);
  }
  // 3 finder patterns (all corners except bottom right; overwrites some timing modules)
  drawFinderPattern(g, 3, 3);
  drawFinderPattern(g, size - 4, 3);
  drawFinderPattern(g, 3, size - 4);
  // Alignment patterns
  const alignPatPos = alignmentPositions(version);
  const numAlign = alignPatPos.length;
  for (let i = 0; i < numAlign; i++) {
    for (let j = 0; j < numAlign; j++) {
      // Don't draw on the three finder corners
      if (!((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0))) {
        drawAlignmentPattern(g, alignPatPos[i]!, alignPatPos[j]!);
      }
    }
  }
  // Configuration data
  drawFormatBits(g, ecc, 0); // Dummy mask value; overwritten later
  drawVersion(g, version);
  return g;
};

/** Places `data` codewords in the zigzag order over the non-function modules (remainder bits stay light). */
const drawCodewords = (g: Grid, data: readonly number[]): void => {
  const size = g.size;
  let i = 0; // Bit index into the data
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (g.functions[y * size + x] === 0 && i < data.length * 8) {
          g.modules[y * size + x] = getBit(data[i >>> 3]!, 7 - (i & 7)) ? 1 : 0;
          i++;
        }
        // Remaining (remainder) modules stay light (initialised to 0).
      }
    }
  }
};

/** Whether mask `mask` inverts module (x, y) (ISO 18004 Table 10). */
export const maskBit = (mask: number, x: number, y: number): boolean => {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new RangeError("Unreachable");
  }
};

/** XORs mask `mask` over the non-function modules (self-inverse). */
const applyMask = (g: Grid, mask: number): void => {
  const size = g.size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (g.functions[y * size + x] === 0 && maskBit(mask, x, y)) g.modules[y * size + x]! ^= 1;
    }
  }
};

const finderPenaltyCountPatterns = (runHistory: readonly number[]): number => {
  const n = runHistory[1]!;
  const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
  return (core && runHistory[0]! >= n * 4 && runHistory[6]! >= n ? 1 : 0) + (core && runHistory[6]! >= n * 4 && runHistory[0]! >= n ? 1 : 0);
};

const finderPenaltyAddHistory = (currentRunLength: number, runHistory: number[], size: number): void => {
  if (runHistory[0] === 0) currentRunLength += size; // Add light border to initial run
  runHistory.pop();
  runHistory.unshift(currentRunLength);
};

const finderPenaltyTerminateAndCount = (currentRunColor: boolean, currentRunLength: number, runHistory: number[], size: number): number => {
  if (currentRunColor) {
    // Terminate dark run
    finderPenaltyAddHistory(currentRunLength, runHistory, size);
    currentRunLength = 0;
  }
  currentRunLength += size; // Add light border to final run
  finderPenaltyAddHistory(currentRunLength, runHistory, size);
  return finderPenaltyCountPatterns(runHistory);
};

/** ISO 18004 mask penalty of the current modules (upstream `getPenaltyScore`). */
export const penaltyScore = (modules: Uint8Array, size: number): number => {
  let result = 0;
  const at = (x: number, y: number): boolean => modules[y * size + x] === 1;
  // Adjacent modules in row having same color, and finder-like patterns
  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runX = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (at(x, y) === runColor) {
        runX++;
        if (runX === 5) result += PENALTY_N1;
        else if (runX > 5) result++;
      } else {
        finderPenaltyAddHistory(runX, runHistory, size);
        if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
        runColor = at(x, y);
        runX = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(runColor, runX, runHistory, size) * PENALTY_N3;
  }
  // Adjacent modules in column having same color, and finder-like patterns
  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runY = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (at(x, y) === runColor) {
        runY++;
        if (runY === 5) result += PENALTY_N1;
        else if (runY > 5) result++;
      } else {
        finderPenaltyAddHistory(runY, runHistory, size);
        if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
        runColor = at(x, y);
        runY = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(runColor, runY, runHistory, size) * PENALTY_N3;
  }
  // 2*2 blocks of modules having same color
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = at(x, y);
      if (color === at(x + 1, y) && color === at(x, y + 1) && color === at(x + 1, y + 1)) result += PENALTY_N2;
    }
  }
  // Balance of dark and light modules
  let dark = 0;
  for (let i = 0; i < modules.length; i++) dark += modules[i]!;
  const total = size * size; // Note that size is odd, so dark/total != 1/2
  // Compute the smallest integer k >= 0 such that (45-5k)% <= dark/total <= (55+5k)%
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * PENALTY_N4;
  return result;
};

/** Builds the symbol for already-padded data codewords (upstream `new QrCode(version, ecl, dataCodewords, msk)`). */
export const buildMatrix = (version: number, ecc: QrEcc, dataCodewords: readonly number[], mask = -1): QrMatrix => {
  if (version < MIN_VERSION || version > MAX_VERSION) throw new RangeError("Version value out of range");
  if (mask < -1 || mask > 7) throw new RangeError("Mask value out of range");
  const g = drawFunctionPatterns(version, ecc);
  drawCodewords(g, addEccAndInterleave(dataCodewords, version, ecc));
  // Do masking
  if (mask === -1) {
    // Automatically choose best mask
    let minPenalty = 1_000_000_000;
    for (let i = 0; i < 8; i++) {
      applyMask(g, i);
      drawFormatBits(g, ecc, i);
      const penalty = penaltyScore(g.modules, g.size);
      if (penalty < minPenalty) {
        mask = i;
        minPenalty = penalty;
      }
      applyMask(g, i); // Undoes the mask due to XOR
    }
  }
  applyMask(g, mask);
  drawFormatBits(g, ecc, mask); // Overwrite old format bits
  return { version, size: g.size, ecc, mask, modules: g.modules, functions: g.functions };
};

/** Encodes `segs` (upstream `QrCode.encodeSegments`). Throws a `RangeError` when the data does not fit `maxVersion`. */
export const encodeQrSegments = (segs: readonly QrSegment[], options: QrEncodeOptions = {}): QrMatrix => {
  let ecc: QrEcc = options.ecc ?? "M";
  const minVersion = options.minVersion ?? MIN_VERSION;
  const maxVersion = options.maxVersion ?? MAX_VERSION;
  const mask = options.mask ?? -1;
  const boostEcc = options.boostEcc ?? true;
  if (!(MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= MAX_VERSION) || mask < -1 || mask > 7) {
    throw new RangeError("Invalid value");
  }
  // Find the minimal version number to use
  let version: number;
  let dataUsedBits: number;
  for (version = minVersion; ; version++) {
    const dataCapacityBits = numDataCodewords(version, ecc) * 8; // Number of data bits available
    const usedBits = totalBits(segs, version);
    if (usedBits <= dataCapacityBits) {
      dataUsedBits = usedBits;
      break; // This version number is found to be suitable
    }
    if (version >= maxVersion) throw new RangeError("Data too long"); // All versions in the range could not fit the given data
  }
  // Increase the error correction level while the data still fits in the current version number
  for (const newEcc of ECC_ORDER.slice(ECC_ORDINAL[ecc] + 1)) {
    if (boostEcc && dataUsedBits <= numDataCodewords(version, newEcc) * 8) ecc = newEcc;
  }
  // Concatenate all segments to create the data bit string
  const bb: number[] = [];
  for (const seg of segs) {
    appendBits(MODE_BITS[seg.mode], 4, bb);
    appendBits(seg.numChars, numCharCountBits(seg.mode, version), bb);
    for (const b of seg.bits) bb.push(b);
  }
  // Add terminator and pad up to a byte if applicable
  const dataCapacityBits = numDataCodewords(version, ecc) * 8;
  appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
  appendBits(0, (8 - (bb.length % 8)) % 8, bb);
  // Pad with alternating bytes until data capacity is reached
  for (let padByte = 0xec; bb.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) appendBits(padByte, 8, bb);
  // Pack bits into bytes in big endian
  const dataCodewords: number[] = new Array<number>(bb.length >>> 3).fill(0);
  for (let i = 0; i < bb.length; i++) dataCodewords[i >>> 3]! |= bb[i]! << (7 - (i & 7));
  return buildMatrix(version, ecc, dataCodewords, mask);
};

/** Encodes `text` (upstream `QrCode.encodeText`): numeric / alphanumeric / UTF-8 byte mode, smallest version. */
export const encodeQr = (text: string, options?: QrEncodeOptions): QrMatrix => encodeQrSegments(makeSegments(text), options);
