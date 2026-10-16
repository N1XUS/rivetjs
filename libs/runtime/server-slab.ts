// Byte slab writer core: the one claim / commit / writeText / writeBytes / writeInteger implementation
// behind NodeStreamWriter (`@rivetjs/runtime/node`) and the router's web stream body (`@rivetjs/router`).
// Writes land in `bytes[offset..]`; `start..offset` is pending output a subclass hands off in `flush()`.
// Subclasses supply string encoding (`write`), the hand-off (`flush`), slab replacement (`renew`), chunks
// larger than any slab (`oversize`) and, when `scheduled` is false, a deferred flush (`schedule`). The
// pending-bytes check is inlined in every write (no helper call per write on the hot path).
import { INTEGER_BYTES, TEXT_UNIT_BYTES, putInt32, putText } from "./server-bytes.ts";
import { escapeText } from "./escape.ts";

/** writeText: strings up to this many code units are escaped + encoded inline; longer ones amortize the regex test and the native encoder call. */
const TEXT_INLINE = 64;

/** A byte writer over a slab: the renderer's byte + raw-slab protocol (`claim(n)`, `bytes`, `offset`, `commit(end)`). */
export abstract class SlabWriter {
  /** The current slab (null before the first write and after `finish`, for writers that pool slabs). */
  declare bytes: Uint8Array | null;
  /** First byte not handed off yet. */
  declare start: number;
  /** Write position. */
  declare offset: number;
  /** Pending bytes (`offset - start`) at which a write flushes; 0 flushes every write (a full queue). */
  declare threshold: number;
  /** Largest chunk a slab holds; bigger byte chunks take `oversize`. */
  declare size: number;
  /** false: a write that stays below the threshold calls `schedule()` (then sets it true until the next flush). */
  declare scheduled: boolean;
  /** Checked on every write: an aborted render stops at its next write. */
  declare signal: AbortSignal | undefined;
  constructor(threshold: number, size: number, scheduled: boolean, signal: AbortSignal | undefined) {
    this.bytes = null;
    this.start = 0;
    this.offset = 0;
    this.threshold = threshold;
    this.size = size;
    this.scheduled = scheduled;
    this.signal = signal;
  }
  /** Encodes a string chunk; returns a promise only under backpressure. */
  abstract write(chunk: string): Promise<void> | undefined;
  /** Hands off `start..offset`; returns a wait under backpressure. */
  abstract flush(): Promise<void> | undefined;
  /** Continues in a slab with at least `size` bytes of room (`start = offset = 0`). */
  abstract renew(size: number): void;
  /** Writes a byte chunk larger than `size` (pending bytes already flushed). */
  abstract oversize(bytes: Uint8Array): Promise<void> | undefined;
  /** Arms a deferred flush (only called while `scheduled` is false). */
  schedule(): void {}
  /** After a flush: a fresh slab when the room left cannot hold `size` bytes. */
  reserve(size: number): void {
    if (this.bytes!.length - this.offset < size) this.renew(size);
  }
  /**
   * Writes `text` HTML-text-escaped (`&` `<` `>`, as escapeText) in one pass: short strings are escaped
   * and UTF-8 encoded straight into the slab (no escaped copy, no native encoder call); long ones take
   * escapeText + `write`. Lone surrogates become U+FFFD, as the native encoders write them.
   */
  writeText(text: string): Promise<void> | undefined {
    const length = text.length;
    if (length > TEXT_INLINE) return this.write(escapeText(text));
    this.signal?.throwIfAborted();
    if (length === 0) return;
    let waiting;
    if (this.bytes === null) this.renew(0);
    if (this.bytes!.length - this.offset < length * TEXT_UNIT_BYTES) {
      waiting = this.flush();
      this.reserve(length * TEXT_UNIT_BYTES);
    }
    this.offset = putText(this.bytes!, this.offset, text);
    if (this.offset - this.start >= this.threshold) return this.flush() ?? waiting;
    if (!this.scheduled) this.schedule();
    return waiting;
  }
  /** Copies pre-encoded UTF-8 bytes; same backpressure contract as write(). */
  writeBytes(bytes: Uint8Array): Promise<void> | undefined {
    this.signal?.throwIfAborted();
    const length = bytes.length;
    if (length === 0) return;
    let waiting;
    if (this.bytes === null) this.renew(0);
    if (this.bytes!.length - this.offset < length) {
      waiting = this.flush();
      if (length > this.size) return this.oversize(bytes) ?? waiting;
      this.reserve(length);
    }
    this.bytes!.set(bytes, this.offset);
    this.offset += length;
    if (this.offset - this.start >= this.threshold) return this.flush() ?? waiting;
    if (!this.scheduled) this.schedule();
    return waiting;
  }
  /** Writes a safe integer as ASCII digits (exactly String(value)): digit pairs for int32, `write` past it. */
  writeInteger(value: number): Promise<void> | undefined {
    // Past int32 (rare): the string path (`String(value)`, ASCII).
    if ((value | 0) !== value) return this.write("" + value);
    this.signal?.throwIfAborted();
    let waiting;
    if (this.bytes === null) this.renew(0);
    if (this.bytes!.length - this.offset < INTEGER_BYTES) {
      waiting = this.flush();
      this.reserve(INTEGER_BYTES);
    }
    this.offset = putInt32(this.bytes!, this.offset, value);
    if (this.offset - this.start >= this.threshold) return this.flush() ?? waiting;
    if (!this.scheduled) this.schedule();
    return waiting;
  }
  /**
   * Raw-slab protocol: make room for `length` (≤ 32 KiB) bytes at `bytes[offset]`. The renderer writes a
   * whole compiled record / list row there, then hands the end offset to `commit`. Returns a wait under
   * backpressure.
   */
  claim(length: number): Promise<void> | undefined {
    this.signal?.throwIfAborted();
    if (this.bytes === null) this.renew(0);
    if (this.bytes!.length - this.offset >= length) return;
    const waiting = this.flush();
    this.reserve(length);
    return waiting;
  }
  /** Records bytes written in place after `claim`; flushes past the threshold. */
  commit(end: number): Promise<void> | undefined {
    this.offset = end;
    if (end - this.start >= this.threshold) return this.flush();
    if (!this.scheduled) this.schedule();
    return;
  }
}
