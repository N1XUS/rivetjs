// libs/runtime/server-slab.ts (excerpt) — the writer every server render goes through.
// A 64 KiB slab from a process-wide pool; flush at 16 KiB; `claim`/`commit` let the renderer
// write a whole list row in place without an intermediate string or array.

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

// libs/runtime/node.ts — the pool. Fresh ArrayBuffers per response add external-memory pressure
// that forces full GCs; a slab returns here only after the sink acknowledged every handed-off range.
const SLAB = 64 * 1024;
const pools = new Map<number, Slab[]>();
const POOL_LIMIT = 32;
function acquire(size: number): Slab {
  return pools.get(size)?.pop() ?? { bytes: Buffer.allocUnsafeSlow(size) as Bytes, pending: 0, retired: false };
}
