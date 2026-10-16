// Response writers: bounded string buffer and a backpressure-aware byte writer for Node streams.
import type { Writable } from "node:stream";
import { SlabWriter } from "./server-slab.ts";

/** Node's internal Buffer UTF-8 encoder (writes in place, returns the byte count). */
type Bytes = Buffer & { utf8Write(chunk: string, offset: number): number };
/** A pooled slab: `pending` handed-off ranges the sink has not acknowledged yet. */
interface Slab {
  bytes: Bytes;
  pending: number;
  retired: boolean;
}
/** The Node writable surface NodeStreamWriter drives. */
export type StreamSink = Pick<Writable, "destroyed" | "writableEnded" | "writableLength" | "write" | "once" | "off">;
/** Options of `NodeStreamWriter`: buffering, abort signal and early bytes. */
export interface NodeStreamWriterOptions {
  threshold?: number;
  maxBuffered?: number;
  signal?: AbortSignal;
  /**
   * Early bytes (default true): once `EARLY` (128 KiB) bytes were handed to the sink, uncork it (a Node
   * `ServerResponse`'s own cork, else `sink.socket`'s) so the response's head leaves while the rest renders —
   * Node's HTTP response otherwise corks a tick's writes into one writev at the end of a synchronous render. Pages
   * under 128 KiB keep one write. Bodies always run to completion (no event-loop yields). Output is unchanged.
   */
  early?: boolean;
}
/** Buffers a bounded complete response for comparison with the streaming emitter. */
export class StringWriter {
  declare maxBytes: number;
  declare bytes: number;
  declare buffer: string;
  /** Creates a response buffer with a maximum UTF-8 byte size. */
  constructor({ maxBytes = 16 * 1024 * 1024 }: { maxBytes?: number } = {}) {
    this.maxBytes = maxBytes;
    this.bytes = 0;
    this.buffer = "";
  }
  /** Appends output, rejecting responses that exceed the configured byte limit. */
  write(chunk: string): void {
    this.bytes += Buffer.byteLength(chunk);
    if (this.bytes > this.maxBytes) {
      this.buffer = "";
      throw new Error("Response byte limit exceeded");
    }
    this.buffer += chunk;
  }
  /** Returns the complete response and releases the writer's reference to it. */
  finish(): string {
    const value = this.buffer;
    this.buffer = "";
    this.bytes = 0;
    return value;
  }
}

const SLAB = 128 * 1024;
// Pending bytes at which a write hands a chunk to the sink (two chunks per slab). Node's HTTP response corks a
// tick's writes into one writev either way; fewer chunks cost less per-chunk JS and chunked-encoding framing.
const THRESHOLD = 48 * 1024;
// Early bytes (NodeStreamWriterOptions.early): handed-off bytes after which the sink is uncorked once.
const EARLY = 128 * 1024;
const ignore = (): void => {};
type Corkable = { writableCorked?: number; uncork?(): void };
/**
 * Send what the sink holds corked now. A Node 26 response corks itself until the next tick (chunked frames
 * buffer in it, its socket corked once per cork): uncork the response, which writes the frames into the
 * still-corked socket (one writev, drain accounting intact). Uncorking only the socket desyncs the counts:
 * later frames reach an uncorked socket one write each, never fill it, and the response's `drain` never fires.
 * Sinks without their own cork: their socket.
 */
function uncork(sink: StreamSink): void {
  const own = sink as Corkable;
  if (own.writableCorked && own.uncork) {
    while (own.writableCorked) own.uncork();
    return;
  }
  const socket = (sink as { socket?: Corkable | null }).socket;
  while (socket?.writableCorked && socket.uncork) socket.uncork();
}
// Process-wide slab pool. Fresh ArrayBuffers per response add external-memory pressure that
// forces full GCs; a slab returns here only after the sink acknowledged every handed-off range.
const pools = new Map<number, Slab[]>();
const POOL_LIMIT = 32;
function acquire(size: number): Slab {
  return pools.get(size)?.pop() ?? { bytes: Buffer.allocUnsafeSlow(size) as Bytes, pending: 0, retired: false };
}
function retire(slab: Slab): void {
  slab.retired = true;
  if (slab.pending === 0) recycle(slab);
}
function recycle(slab: Slab): void {
  let pool = pools.get(slab.bytes.length);
  if (!pool) pools.set(slab.bytes.length, (pool = []));
  if (pool.length >= POOL_LIMIT) return;
  slab.retired = false;
  pool.push(slab);
}

/**
 * Encodes HTML into bounded UTF-8 chunks and waits for a Node response stream to accept further output.
 * Byte writes, writeText and the raw-slab protocol come from SlabWriter (shared with the router's web body).
 */
export class NodeStreamWriter extends SlabWriter {
  declare sink: StreamSink;
  declare maxBuffered: number;
  declare slab: Slab | null;
  declare bytes: Bytes | null;
  /** Early bytes pending: `handed` bytes went to the sink so far. */
  declare early: boolean;
  declare handed: number;
  /** The pending backpressure wait: one per writer (a second wait a caller drops would reject unhandled on abort). */
  declare waiting: Promise<void> | null;
  /** Creates a writer for a caller-owned sink with an optional cancellation signal. */
  declare later: () => void;
  constructor(sink: StreamSink, { threshold = THRESHOLD, maxBuffered = 256 * 1024, signal, early = true }: NodeStreamWriterOptions = {}) {
    if (!Number.isInteger(threshold) || threshold < 1) throw new Error("Invalid stream threshold");
    if (!Number.isInteger(maxBuffered) || maxBuffered < 0) throw new Error("Invalid stream buffer bound");
    // Flushed chunks are subarrays of the slab; later writes never overwrite a handed-off range. Flushes
    // are synchronous at the threshold, and in a microtask once the render pauses (an await, the end):
    // a shell before a pending boundary leaves at once whatever its size.
    super(threshold, Math.max(SLAB, threshold * 2), false, signal);
    this.sink = sink;
    // Bytes the sink may queue before rendering waits for drain. Waiting at the socket's own
    // small high-water mark turns every flush into a suspension when clients read slowly.
    this.maxBuffered = maxBuffered;
    this.slab = null;
    this.early = early;
    this.handed = 0;
    this.waiting = null;
    // A paused render's pending bytes: no backpressure wait to hand back (the next write's flush returns it).
    this.later = () => {
      if (this.bytes === null || this.offset === this.start) return (this.scheduled = false), undefined;
      try {
        // A backpressure wait nobody awaits: a close / error / abort it rejects with reaches the render through
        // its next write (closed sink / aborted signal checks), never as an unhandled rejection.
        this.flush()?.catch(ignore);
      } catch {
        /* Aborted or closed: the render's next write throws. */
      }
    };
  }
  override schedule(): void {
    this.scheduled = true;
    queueMicrotask(this.later);
  }
  /** Retire the current slab (if any) and continue in a fresh or recycled one (every request fits one). */
  renew(): void {
    if (this.slab) retire(this.slab);
    this.slab = acquire(this.size);
    this.bytes = this.slab.bytes;
    this.start = this.offset = 0;
  }
  /** Encodes a string chunk; returns a promise only when the underlying sink applies backpressure. */
  write(chunk: string): Promise<void> | undefined {
    this.signal?.throwIfAborted();
    const length = chunk.length;
    if (length === 0) return;
    let waiting;
    if (this.bytes === null) this.renew();
    // A UTF-16 code unit encodes to at most three UTF-8 bytes.
    if (this.bytes!.length - this.offset < length * 3) {
      waiting = this.flush();
      if (length * 3 > this.size) return this.send(chunk) ?? waiting;
      this.reserve(length * 3);
    }
    this.offset += this.bytes!.utf8Write(chunk, this.offset);
    if (this.offset - this.start >= this.threshold) return this.flush() ?? waiting;
    if (!this.scheduled) this.schedule();
    return waiting;
  }
  /** A byte chunk larger than a slab goes to the sink as it is. */
  oversize(bytes: Uint8Array): Promise<void> | undefined {
    return this.send(bytes);
  }
  /** Flushes remaining bytes without closing the caller-owned sink; a later write starts a new slab. */
  finish(): Promise<void> | undefined {
    this.early = false;
    const result = this.flush();
    if (this.slab) retire(this.slab);
    this.slab = this.bytes = null;
    return result;
  }
  /** Hands the pending byte range to the sink, starting a fresh slab when too little room remains. */
  flush(): Promise<void> | undefined {
    this.scheduled = false;
    this.signal?.throwIfAborted();
    if (this.offset === this.start) return;
    const slab = this.slab!;
    const chunk = this.bytes!.subarray(this.start, this.offset);
    this.start = this.offset;
    // Protect this range before renewal can retire and recycle its slab.
    slab.pending++;
    if (this.bytes!.length - this.offset < this.threshold) this.renew();
    const waiting = this.send(chunk, () => {
      if (--slab.pending === 0 && slab.retired) recycle(slab);
    });
    if (this.early && (this.handed += chunk.length) >= EARLY) {
      this.early = false;
      uncork(this.sink);
    }
    return waiting;
  }
  /** Writes one chunk and releases wait listeners on drain, failure, or abort. */
  send(chunk: string | Uint8Array, written?: () => void): Promise<void> | undefined {
    if (this.sink.destroyed || this.sink.writableEnded) throw new Error("Response stream closed");
    if (this.sink.write(chunk, written) || this.sink.writableLength < this.maxBuffered) return;
    // Two flushes in one write (room, then threshold) both see backpressure: `flush() ?? waiting` keeps only one.
    return (this.waiting ??= new Promise<void>((resolve, reject) => {
      const done = (error?: unknown) => {
        this.waiting = null;
        this.sink.off("drain", drained);
        this.sink.off("error", failed);
        this.sink.off("close", closed);
        this.signal?.removeEventListener("abort", aborted);
        error ? reject(error) : resolve();
      };
      const drained = () => done();
      const failed = (error: unknown) => done(error);
      const closed = () => done(new Error("Response stream closed"));
      const aborted = () => done(this.signal!.reason ?? new DOMException("Aborted", "AbortError"));
      this.sink.once("drain", drained);
      this.sink.once("error", failed);
      this.sink.once("close", closed);
      this.signal?.addEventListener("abort", aborted, { once: true });
      if (this.signal?.aborted) aborted();
    }));
  }
}
