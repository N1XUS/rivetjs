// List rows in chunks through a WebAssembly (SIMD) emitter, for byte writers with the raw-slab protocol
// (`claim` / `commit`). A chunk's string slots are copied into the module's memory with one native UTF-8 encode
// (joined first; no escape check, no escaping in JS), each slot's UTF-16 length recorded; int32 slots go into a
// number array.
// One wasm call per chunk interleaves the plan's encoded fragments, escapes text (& < >) and attribute values
// (& < > " '), writes the digits; the chunk is then copied into the writer's slab. Output is byte-identical to
// the per-row path (`rawRow` / `rawTemplate`, tests/server-rows.test.ts). A row the emitter does not take (a
// URL attribute value that needs the scheme check — anything not starting with `/` `#` `?` `.`, every URL list —,
// a null / boolean attribute, an object, a non-int32 number, a string too long for a chunk) ends the call: the caller writes it the usual way and may call again. Without WebAssembly (or
// where compiling a module from bytes is refused: Cloudflare Workers, strict CSP runtimes) the first call
// fails over to the caller's path, silently and for the life of the process.
// Pulled in by `_listPlan` only: a server bundle without compiled list rows carries none of it.
import { ROWS_LAYOUT as M, ROWS_WASM } from "./server-rows-wasm.ts";

/** A plan slot as server.ts's PlanSlot: null = child, a number = a flattened component's bounds (writes nothing), else an attribute. */
type Slot = null | number | { readonly raw: { readonly text: string; readonly url: string | null; readonly list?: boolean } | null };
/** The parts of a list plan the emitter reads (server.ts ListPlan). */
export interface RowPlan {
  readonly fragments: readonly string[];
  readonly attributes: readonly Slot[];
}
/** The raw-slab protocol of a byte writer (server.ts ServerWriter). */
export interface RowSlab {
  claim?(length: number): unknown;
  commit?(end: number): unknown;
  readonly bytes?: Uint8Array | null;
  readonly offset?: number;
}
/** Returned instead of the next row when the writer applied backpressure: the caller waits, then continues at `row`. */
export interface RowsWait {
  readonly wait: unknown;
  readonly row: number;
}
type Emit = (rows: number, width: number, input: number, lens: number, out: number, table: number) => number;
type Utf8Write = (text: string, offset: number, length: number) => number;

/** 0 = not tried yet, 1 = ready, 2 = unavailable (fallback for the process). */
let state = 0;
let emit: Emit;
let memory: Uint8Array;
let lens: Int32Array;
let nums: Int32Array;
let utf8: (text: string, at: number, end: number) => number;
let loaded: RowPlan | null = null;
// Per plan: [encoded fragments, table words, fixed bytes per row]; null = the plan's shape is not supported.
const plans = new WeakMap<RowPlan, readonly [Uint8Array, Int32Array, number] | null>();
const encoder = new TextEncoder();
/** Chunk output target (bytes of the worst-case bound) and the slab piece size per claim (the raw-slab limit). */
const CHUNK = 128 * 1024;
const PIECE = 32 * 1024;
const MAX_LENS = (M.nums - M.lens) >> 2;
const MAX_TABLE = (M.fragments - M.table) / 12;
/** Worst-case output bytes per string UTF-16 unit (`"` → `&quot;`) and per int32 (sign + 10 digits). */
const ESCAPED = 6;
const DIGITS = 11;
/** Output room: the 16-byte block stores may run up to 16 bytes past the last written byte. */
const ROOM = M.end - M.out - 32;

function start(): boolean {
  state = 2;
  try {
    if (typeof WebAssembly !== "object") return false;
    const raw = atob(ROWS_WASM);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const mem = new WebAssembly.Memory({ initial: M.pages, maximum: M.pages });
    const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes), { e: { mem } });
    const buffer = mem.buffer;
    const NodeBuffer = (globalThis as { Buffer?: { from(buffer: ArrayBuffer): Uint8Array } }).Buffer;
    memory = NodeBuffer ? NodeBuffer.from(buffer) : new Uint8Array(buffer);
    const native = (memory as Uint8Array & { utf8Write?: Utf8Write }).utf8Write;
    // Explicit length: workerd's (nodejs_compat) Buffer#utf8Write throws ERR_OUT_OF_RANGE without it.
    utf8 =
      native !== undefined
        ? (text, at, end) => native.call(memory, text, at, end - at)
        : (text, at, end) => encoder.encodeInto(text, memory.subarray(at, end)).written;
    lens = new Int32Array(buffer, M.lens, MAX_LENS);
    nums = new Int32Array(buffer, M.nums, MAX_LENS);
    emit = instance.exports.emit as Emit;
    // Self-check (SIMD semantics, memory layout): one row `<b>` "a&<"x" `</b>` → `<b>a&amp;&lt;"x</b>`.
    loaded = null;
    const probe: RowPlan = { fragments: ["<b>", "</b>"], attributes: [null] };
    load(probe, shape(probe)!);
    utf8('a&<"x', M.input, M.out);
    lens[0] = 5;
    const end = emit(1, 1, M.input, M.lens, M.out, M.table);
    if (String.fromCharCode(...memory.subarray(M.out, end)) !== '<b>a&amp;&lt;"x</b>') return false;
    state = 1;
    return true;
  } catch {
    return false;
  }
}

/** Test hook: false forces the per-row path for the rest of the process (until called with true). */
export function _setListRows(enabled: boolean): void {
  state = enabled ? 0 : 2;
}

function shape(plan: RowPlan): readonly [Uint8Array, Int32Array, number] | null {
  let info = plans.get(plan);
  if (info !== undefined) return info;
  info = null;
  const { attributes, fragments } = plan;
  const width = attributes.length;
  if (width + 1 <= MAX_TABLE) {
    const parts: Uint8Array[] = [];
    const table = new Int32Array((width + 1) * 3);
    let size = 0,
      ok = true;
    for (let k = 0; k <= width && ok; k++) {
      // An attribute's ` name="` joins the fragment before its value, the closing quote the one after.
      let text = fragments[k]!;
      const before = k > 0 ? attributes[k - 1]! : null;
      const slot = k < width ? attributes[k]! : null;
      if (before !== null && typeof before === "object") text = '"' + text;
      if (slot !== null && typeof slot === "object") {
        if (slot.raw === null) ok = false;
        else text += slot.raw.text;
      }
      const part = encoder.encode(text);
      table[k * 3] = M.fragments + size;
      table[k * 3 + 1] = part.length;
      table[k * 3 + 2] = slot !== null && typeof slot === "object" ? 1 : 0;
      parts.push(part);
      size += part.length;
    }
    // Room for the 16-byte block over-read past the last fragment.
    if (ok && M.fragments + size + 16 <= M.lens) {
      const all = new Uint8Array(size);
      let at = 0;
      for (const part of parts) (all.set(part, at), (at += part.length));
      info = [all, table, size];
    }
  }
  plans.set(plan, info);
  return info;
}

function load(plan: RowPlan, info: readonly [Uint8Array, Int32Array, number]): void {
  if (loaded === plan) return;
  memory.set(info[0], M.fragments);
  new Int32Array(memory.buffer, M.table, info[1].length).set(info[1]);
  loaded = plan;
}

/**
 * Writes rows `row..rows` of a list tape (`width` = plan slots per row) through the emitter. Returns the first
 * row it did not write (`rows` when done, `row` itself when it does not take that row), -1 when it takes no
 * row of this plan (no WebAssembly, a boolean attribute in the plan), or a RowsWait when the writer returned
 * a wait (rows before `wait.row` are written). `mark` (row-region plans of server-resume, MARK-branded fragments):
 * slot 0 is the row's marker id, passed through `mark(id, mode)` once the row is taken (the renderer's `markOut`:
 * -1 = left out, it continues the stride).
 */
export function _listRows(
  plan: RowPlan,
  tape: readonly unknown[],
  row: number,
  rows: number,
  writer: RowSlab,
  signal: AbortSignal | undefined,
  mark?: (id: number, mode: number) => number,
  mode?: number,
): number | RowsWait {
  if (state !== 1 && (state === 2 || !start())) return -1;
  const info = shape(plan);
  if (info === null) return -1;
  load(plan, info);
  const attributes = plan.attributes,
    width = attributes.length,
    fixed = info[2];
  // String slots join one pending JS string, encoded with ONE native UTF-8 write per chunk (`put`): per-slot writes of
  // fresh (cons) strings cost ~35 ns each, 2000 slots 68 -> 19 us (lane SEGMENTS). The bytes are the same as per-slot
  // encodes (UTF-8 of a concatenation = the concatenation of the encodings) except across a lone high surrogate ending a
  // slot, which a following low one would pair with: such a slot is written at once. `at` = an upper bound of the input
  // bytes (3 per UTF-16 unit) the input room check uses; `real` = bytes written; `units` = UTF-16 units of the chunk's
  // strings: at most ESCAPED output bytes each (only ASCII is escaped; a non-ASCII unit is at most 3 bytes), the bound the
  // output room checks use (an ASCII string: units = bytes, the same chunks as per-slot writes).
  let n = 0,
    li = 0,
    at: number = M.input,
    real: number = M.input,
    pending = "",
    units = 0,
    ints = 0,
    waiting: unknown;
  const put = (): void => {
    if (pending !== "") ((real += utf8(pending, real, M.out)), (pending = ""));
  };
  // Emits the buffered rows and copies them into the writer's slab (all accepted under backpressure; the
  // first wait is kept).
  const flush = (): void => {
    if (n === 0) return;
    put();
    const end = emit(n, width, M.input, M.lens, M.out, M.table);
    n = li = ints = units = 0;
    at = real = M.input;
    for (let from: number = M.out; from < end;) {
      const length = Math.min(end - from, PIECE);
      const claimed = writer.claim!(length);
      const offset = writer.offset!;
      writer.bytes!.set(memory.subarray(from, from + length), offset);
      const committed = writer.commit!(offset + length);
      waiting ??= claimed ?? committed;
      from += length;
    }
  };
  let r = row;
  rowLoop: for (; r < rows; r++) {
    signal?.throwIfAborted();
    if (li + width > MAX_LENS) {
      flush();
      if (waiting !== undefined) return { wait: waiting, row: r };
    }
    const base = r * width;
    for (let attempt = 0; ; attempt++) {
      const rowAt = at,
        rowReal = real,
        rowPending = pending,
        rowUnits = units,
        rowInts = ints;
      let fits = true,
        k = 0;
      for (; k < width; k++) {
        const slot = attributes[k]!,
          child = tape[base + k];
        if (typeof slot === "number") lens[li + k] = 0;
        else if (typeof child === "string") {
          // A single URL starting with `/` `#` `?` `.` has no scheme (as the per-row paths decide); others take that path.
          if (slot !== null && slot.raw!.url !== null) {
            const first = child.charCodeAt(0);
            if (slot.raw!.list || (first !== 47 && first !== 35 && first !== 63 && first !== 46)) break;
          }
          const size = child.length * 3;
          if (at + size > M.out) {
            fits = false;
            break;
          }
          at += size;
          units += child.length;
          pending += child;
          if ((child.charCodeAt(child.length - 1) & 0xfc00) === 0xd800) put();
          lens[li + k] = child.length;
        } else if (typeof child === "number") {
          if ((child | 0) !== child) break;
          nums[li + k] = child;
          lens[li + k] = -1;
          ints++;
        } else if (slot === null && (child == null || typeof child === "boolean")) lens[li + k] = 0;
        else break;
      }
      if (fits && k === width && (n + 1) * fixed + units * ESCAPED + ints * DIGITS <= ROOM) {
        // The marker id (an int32 slot, counted in the bound above): written or left out as the renderer decides.
        if (mark !== undefined && lens[li] === -1) {
          const id = mark(nums[li]!, mode!);
          if (id < 0) lens[li] = 0;
          else nums[li] = id;
        }
        li += width;
        n++;
        if (n * fixed + units * ESCAPED + ints * DIGITS >= CHUNK) {
          flush();
          if (waiting !== undefined) return { wait: waiting, row: r + 1 };
        }
        continue rowLoop;
      }
      at = rowAt;
      real = rowReal;
      pending = rowPending;
      units = rowUnits;
      ints = rowInts;
      // Not this row (or it alone exceeds a chunk): the caller writes it.
      if (k < width && fits) break rowLoop;
      if (n === 0 || attempt > 0) break rowLoop;
      flush(); // the row did not fit behind the buffered ones: emit them and retry it in an empty chunk
      if (waiting !== undefined) return { wait: waiting, row: r };
    }
  }
  flush();
  return waiting !== undefined ? { wait: waiting, row: r } : r;
}
