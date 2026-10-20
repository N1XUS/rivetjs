/** A callable reactive getter with explicit write operations. Invariant in `T` (`set`/`update` are function
 * properties, checked contravariantly): a `Signal<"a" | "b">` is not a `Signal<string>`; pass the getter
 * (`() => string`) to read-only consumers. Both need `this` = the signal at run time (call them on it, or
 * bind them); the type does not model `this`, so a `Signal<A> | Signal<B>` union stays callable. */
export interface Signal<T> {
  (): T;
  /** Set a value and synchronously notify effects outside a batch. */
  set: (value: T) => T;
  /** Transform the value without tracking reads in the transform. */
  update: (fn: (value: T) => T) => T;
}
/** Error type returned by `effect`/`computed` given an async function (or one returning a Promise): both
 * run synchronously, so reads after the first `await` are untracked. Start the async work inside and write
 * a signal when it settles (or use `@rivetjs/runtime/async`). */
export interface AsyncFunctionNotAllowed {
  "rivet: effect and computed functions must be synchronous (reads after an await are untracked); start the async work inside and write a signal when it settles": never;
}
/** `Ok` for `any`/`never` results (a function that only throws), else `AsyncFunctionNotAllowed`. */
export type NotAsync<R, Ok> = 0 extends 1 & R ? Ok : [R] extends [never] ? Ok : AsyncFunctionNotAllowed;
/** An idempotent synchronous cleanup function. */
export type Disposer = () => void;
/** An identity token used by synchronous owner context lookup. */
export interface Context<T> { readonly defaultValue: T; readonly id?: string; }
/** Equality used to skip notifications: `true` means equal (no notify); `false` always notifies. */
export interface EqualsOptions<T> { equals?: false | ((previous: T, next: T) => boolean); }
declare const ownerBrand: unique symbol;
/** Opaque logical ownership handle; capture it rather than constructing one. */
interface OwnerHandle { readonly [ownerBrand]: true; }
export type { OwnerHandle as Owner };

// Context frame: one per provide/catchError owner, linked to the frame visible at that owner (`up`). Every owner
// points at the nearest frame above it (`ctx`, inherited on creation), so lookups walk providers, not owners.
// A lookup that walks past MEMO frames remembers its result on the starting frame (`memo`: token → the
// providing frame, null = default), so wide/deep provider stacks cost one Map hit per repeated lookup.
// Frames are immutable (token, value, up), so a memo never goes stale.
interface Frame { token: Context<unknown>; value: unknown; up: Frame | null; owner: Owner; memo: Map<Context<unknown>, Frame | null> | null }
const MEMO = 8;
type Equals = ((a: unknown, b: unknown) => boolean) | null;
type Tracked = Node | Source;
// Graph links stay inline while single (most bindings read one source; most signals have one
// observer): the link itself and a smi slot. A second link promotes both sides to arrays.
type Links<T> = T | T[] | null;
type Slots = number | number[];
const isArray = Array.isArray as (value: unknown) => value is unknown[];
const count = (links: Links<unknown>): number => (links === null ? 0 : isArray(links) ? links.length : 1);
type Getter = (() => unknown) & { [SIGNAL]?: Source; [COMPUTED]?: Node };
// `_trackReads` collector: reads in first-read order (signal getters, computed nodes), deduped by scan while
// short, by `index` once longer; `computed` marks whether a source walk is needed.
interface Collector { kind: typeof COLLECTOR; disposed: boolean; add: (this: Collector, source: Tracked) => void; key: (this: Collector, selector: Selector, key: unknown) => unknown; keyed: KeyedRead | null; reads: (Getter | Node)[] | null; index: Set<unknown> | null; computed: boolean }
/** `_trackReads`'s keyed hook: a `selector(signal)` read of `key` whose wake is the key's own (`kind`: 0 the previous / next
 * value's keys — default `fn`; 1 `memberKeys`). True: recorded keyed (the collector does not list `signal` for it). */
export type KeyedRead = (signal: Signal<unknown>, kind: 0 | 1, key: unknown) => boolean;

const SIGNAL = Symbol('rivet.signal');
const COMPUTED = Symbol('rivet.computed');
// Node kinds and states. Push marks consumers DIRTY (a direct source changed) or CHECK (an upstream
// computed may have changed); pull re-evaluates only what changed, so a computed that recomputes to an
// equal value stops propagation.
const OWNER = 0, COMPUTE = 1, EFFECT = 2, COLLECTOR = 3, SOURCE = 4;
const CLEAN = 0, CHECK = 1, DIRTY = 2;
const RUNNING = 1, FAILED = 2, READY = 4;
let provideObserver: (<T>(token: Context<T>, value: T) => void) | null = null;
let currentOwner: Owner | null = null;
let currentObserver: Node | Collector | null = null;
let batchDepth = 0;
let computedDepth = 0;
let flushing = false;
// Set while an effect owning children is queued: only then can an owner need to run first.
let nested: boolean | undefined;
let epoch = 0;
let repeats: Map<Node, number> | null = null;
const queue: Node[] = [];
// Deferred event flush (`_dispatch` of a trusted mouse click): `held` releases the flush its handlers left
// queued — run before any other batch, signal write outside a batch, or other event's handlers, so updates
// never reorder. Null otherwise: a page that never dispatches a deferred event ships only these checks.
let held: (() => void) | null = null;
// Internal DOM bindings may release an unobserved, source-free leaf after initialization. An owner identity
// handed out (`getOwner`, a computed getter) during a binding's initialization keeps it: `observations` counts
// those hand-outs, a binding compares it before and after its first run (no per-binding probe stack).
let observations = 0;
let observedBindings = false;

// Owners link children in a doubly linked list, newest first (O(1) add/remove; no tail slot). Reactive nodes
// initialize common fields in one order; computeds append their cached-value/source fields through
// a separate constructor, so effects do not reserve those slots. Collections allocate on first use.
class Owner {
  declare kind: number;
  declare parent: Owner | null;
  declare first: Owner | null;
  declare prev: Owner | null;
  declare next: Owner | null;
  declare cleanups: Disposer | Disposer[] | null;
  // Nearest context frame (inherited from the parent; a provide/catchError owner's own frame has `owner` = it).
  declare ctx: Frame | null;
  declare disposed: boolean;
  constructor(parent: Owner | null) {
    this.kind = OWNER;
    this.parent = parent;
    this.first = null;
    this.prev = null;
    this.next = null;
    this.cleanups = null;
    this.ctx = parent === null ? null : parent.ctx;
    this.disposed = false;
  }
}
class Node extends Owner {
  declare kind: typeof COMPUTE | typeof EFFECT;
  declare fn: () => unknown;
  declare value: unknown;
  declare equals: Equals;
  declare state: number;
  // RUNNING | FAILED | READY bits (one smi: computeds carry no separate failed/ready fields).
  declare flags: number;
  declare sources: Links<Tracked>;
  declare slots: Slots;
  declare observers: Links<Node>;
  declare oslots: Slots;
  declare cursor: number;
  declare epoch: number;
  declare seen: number;
  constructor(kind: typeof COMPUTE | typeof EFFECT, parent: Owner | null, fn: () => unknown) {
    super(parent);
    this.kind = kind;
    this.fn = fn;
    this.state = DIRTY;
    this.flags = 0;
    // Sources this node read, with each one's slot in that source's observer list (O(1) unlink).
    this.sources = null;
    this.slots = 0;
    // Tracking cursor for the current run: reads matching the previous run's order reuse its links.
    this.cursor = 0;
    this.epoch = 0;
  }
}
class ComputedNode extends Node {
  constructor(parent: Owner | null, fn: () => unknown, equals: Equals) {
    super(COMPUTE, parent, fn);
    this.value = undefined;
    this.equals = equals;
    // Only computeds can be sources, with observers and a last-seen tracking epoch.
    this.observers = null;
    this.oslots = 0;
    this.seen = 0;
  }
  // Computed-only run outcomes (methods: an app without computeds ships none of this).
  settle(value: unknown): void {
    const equals = this.equals;
    const flags = this.flags & ~FAILED;
    this.flags = flags;
    if (!(flags & READY) || equals === null || !equals(this.value, value)) {
      this.flags = flags | READY;
      this.value = value;
      this.changed();
    }
  }
  // A failed run caches its error in `value` (no recompute until a source changes; reads rethrow it), like
  // TC39 / Angular / Preact computeds. Always a change: the next successful value notifies too.
  fail(error: unknown): void {
    this.flags = (this.flags | FAILED) & ~READY;
    this.value = error;
    this.changed();
  }
  // Consumers waiting on CHECK now must re-run; a consumer mid-run (CLEAN) reads this value.
  changed(): void {
    const observers = this.observers;
    if (observers !== null) {
      if (!isArray(observers)) { if (observers.state === CHECK) observers.state = DIRTY; }
      else for (let i = 0; i < observers.length; i++) if (observers[i].state === CHECK) observers[i].state = DIRTY;
    }
  }
}
// Closure-free binding (`_bindingEffect1`): `fn` is the shared `callArg`, which calls the hoisted module-level
// `call` with up to three captures (`run` calls `node.fn()` as a method). Own class: effects and computeds keep
// their shapes and `run` is unchanged. Three inline slots, not a captures array: an element + two values (the
// common compiled binding) cost 12 B in Chromium instead of a 36 B array.
class ArgNode extends Node {
  declare call: (a: unknown, b: unknown, c: unknown) => unknown;
  declare a: unknown;
  declare b: unknown;
  declare c: unknown;
  constructor(parent: Owner | null, call: (a: unknown, b: unknown, c: unknown) => unknown, a: unknown, b: unknown, c: unknown) {
    super(EFFECT, parent, callArg);
    this.call = call;
    this.a = a;
    this.b = b;
    this.c = c;
  }
}
function callArg(this: ArgNode): unknown { return this.call(this.a, this.b, this.c); }
class Source {
  declare kind: typeof SOURCE;
  declare value: unknown;
  declare equals: Equals;
  declare observers: Links<Node>;
  declare oslots: Slots;
  declare seen: number;
  declare getter: Signal<unknown> | null;
  constructor(value: unknown, equals: Equals) {
    this.kind = SOURCE;
    this.value = value;
    this.equals = equals;
    this.observers = null;
    this.oslots = 0;
    this.seen = 0;
    this.getter = null;
  }
}

const keepCollector = (observer: Node | Collector | null): Collector | null => (observer !== null && observer.kind === COLLECTOR ? observer : null);
const comparator = <T>(options: EqualsOptions<T> | undefined): Equals => (options?.equals === undefined ? Object.is : (options.equals as Equals) || null);

// V8 keeps a class instance's final map alive only through live instances (the constructor's field
// transitions are weak): after a full GC with no owner / effect alive (an unmount, an idle server) the maps
// are cleared and every function that embedded them deopts (context suite DOM themed-500 after GC: mount
// 1.26 → 1.05 ms, dispose 0.095 → 0.02). One parentless instance per class, made with the first real one,
// keeps them (`computed` pins its own class).
let pins: Owner[] | null = null,
  computedPin: Owner | null = null;
function adopt<N extends Owner>(parent: Owner | null, node: N): N {
  if (pins === null) pins = [new Owner(null), new Node(EFFECT, null, Object)];
  if (parent === null) return node;
  if (parent.disposed) throw new Error('Cannot create a child of a disposed owner');
  const first = parent.first;
  if (first !== null) { first.prev = node; node.next = first; }
  parent.first = node;
  return node;
}
const owner = (parent: Owner | null = currentOwner): Owner => adopt(parent, new Owner(parent));
// `_wrapEffects` hook (server-resume): re-enter the creating request's async context on later runs.
let wrapEffect: ((fn: () => unknown) => () => unknown) | null = null;
const reactive = (fn: () => unknown): Node => adopt(currentOwner, new Node(EFFECT, currentOwner, wrapEffect === null ? fn : wrapEffect(fn)));

function unlink(node: Owner): void {
  const parent = node.parent;
  if (parent === null) return;
  if (node.prev !== null) node.prev.next = node.next; else parent.first = node.next;
  if (node.next !== null) node.next.prev = node.prev;
  node.prev = node.next = null;
}

function subscribe(node: Node, source: Tracked): void {
  const sources = node.sources, observers = source.observers;
  const slot = count(observers), index = count(sources);
  if (sources === null) { node.sources = source; node.slots = slot; }
  else if (isArray(sources)) { sources.push(source); (node.slots as number[]).push(slot); }
  else { node.sources = [sources, source]; node.slots = [node.slots as number, slot]; }
  if (observers === null) { source.observers = node; source.oslots = index; }
  else if (isArray(observers)) { observers.push(node); (source.oslots as number[]).push(index); }
  else { source.observers = [observers, node]; source.oslots = [source.oslots as number, index]; }
}

// Unlink the node's last source; the source's last observer fills the vacated slot.
function unsubscribeLast(node: Node): void {
  const sources = node.sources!;
  let source: Tracked, slot: number;
  if (isArray(sources)) { source = sources.pop()!; slot = (node.slots as number[]).pop()!; }
  else { source = sources; slot = node.slots as number; node.sources = null; }
  const observers = source.observers!;
  // A single inline observer is this node.
  if (!isArray(observers)) source.observers = null;
  else {
    const oslots = source.oslots as number[];
    const last = observers.pop()!, lastSlot = oslots.pop()!;
    if (slot < observers.length) {
      observers[slot] = last;
      oslots[slot] = lastSlot;
      const slots = last.slots;
      if (isArray(slots)) slots[lastSlot] = slot; else last.slots = slot;
    }
    // Several readers of a selector key: the emptied array becomes null, so the selector sees it unobserved.
    if (observers.length !== 0 || source.equals !== KEY) return;
    source.observers = null;
  }
  // A selector key source lost its last reader: tell its selector (`KEY` sentinel `equals`; the call goes through
  // the instance, so bundles without `selector` keep no selector code).
  if (source.equals === KEY) (source.value as Selector).dropped();
}

// A disposed node never runs again: unlink its sources and release its function (and the closures,
// DOM and data it holds). `value` stays: a disposed computed keeps returning its last value.
const released = (): void => {};
function detach(node: Node): void {
  while (node.sources !== null && count(node.sources)) unsubscribeLast(node);
  node.fn = released;
}

// Settle the run's reads: a run that only read a prefix of the previous order unlinks the rest.
function commit(node: Node): void {
  // cursor -1: the run diverged from the previous order (its links are exact already).
  if (node.cursor >= 0) while (count(node.sources) > node.cursor) unsubscribeLast(node);
}

function cleanCallbacks(node: Owner, errors: unknown[] | null): unknown[] | null {
  const callbacks = node.cleanups;
  if (!callbacks) return errors;
  node.cleanups = null;
  const previousOwner = currentOwner, previousObserver = currentObserver;
  currentOwner = null; currentObserver = null;
  try {
    if (typeof callbacks === 'function') {
      try { callbacks(); } catch (error) { (errors ??= []).push(error); }
    } else for (const callback of callbacks) {
      try { callback(); } catch (error) { (errors ??= []).push(error); }
    }
  } finally { currentOwner = previousOwner; currentObserver = previousObserver; }
  return errors;
}

function dispose(node: Owner): void {
  if (node.disposed) return;
  // Only the top node leaves its parent's list; descendants go with their (disposed) parents.
  unlink(node);
  // Depth-first without a stack: entering a node marks and detaches it, then descends to its oldest
  // child (children are linked newest first, so the tail); leaving it runs its cleanups, then moves to
  // the next newer sibling (`prev`), else leaves the parent. Children go in creation order, before
  // their parents' cleanups.
  let errors: unknown[] | null = null, item: Owner = node;
  for (;;) {
    item.disposed = true;
    if (item.kind !== OWNER) detach(item as Node);
    let child = item.first;
    if (child !== null) {
      while (child.next !== null) child = child.next;
      // Skip children disposed meanwhile (a sibling's cleanup may dispose them; they unlink then).
      item = child;
      continue;
    }
    // Leave `item` and every ancestor whose children are all done.
    for (;;) {
      item.first = null;
      if (item.cleanups !== null) errors = cleanCallbacks(item, errors);
      if (item === node) { if (errors !== null) fail(errors); return; }
      // A cleanup may have disposed (and unlinked) newer siblings: `prev` skips them.
      let newer = item.prev;
      while (newer !== null && newer.disposed) newer = newer.prev;
      if (newer !== null) { item = newer; break; }
      item = item.parent!;
    }
  }
}

// Dispose the children in creation order (the list is newest first: walk to the oldest, then back
// through `prev`), then run the node's cleanups; null when nothing failed. Allocates only on failure.
function reset(node: Owner): unknown[] | null {
  let errors: unknown[] | null = null;
  // Re-scan if a cleanup disposed a sibling still to visit (its links are cleared then).
  while (node.first !== null) {
    let child: Owner | null = node.first;
    while (child.next !== null) child = child.next;
    while (child !== null) {
      const newer: Owner | null = child.prev;
      try { dispose(child); } catch (error) { (errors ??= []).push(error); }
      child = newer;
    }
  }
  return cleanCallbacks(node, errors);
}

function track(source: Tracked): void {
  const node = currentObserver;
  if (node === null || node.disposed) return;
  if (node.kind === COLLECTOR) { node.add(source); return; }
  const seen = source.seen;
  if (seen === node.epoch) return;
  source.seen = node.epoch;
  // A run nested in this one (newer epoch) read it since: this run may have read it before that.
  if (seen > node.epoch && linked(node, source)) return;
  if (node.cursor >= 0) {
    const sources = node.sources;
    if (sources !== null && (isArray(sources) ? sources[node.cursor] === source : node.cursor === 0 && sources === source)) { node.cursor++; return; }
    // First read off the previous run's order: drop the old suffix, subscribe from here on.
    while (count(node.sources) > node.cursor) unsubscribeLast(node);
    node.cursor = -1;
  }
  subscribe(node, source);
}

// Whether `node` already links `source` in this run (reads before the cursor, or all once diverged).
function linked(node: Node, source: Tracked): boolean {
  const sources = node.sources;
  if (sources === null) return false;
  if (!isArray(sources)) return sources === source && node.cursor !== 0;
  for (let i = 0, n = node.cursor >= 0 ? node.cursor : sources.length; i < n; i++) if (sources[i] === source) return true;
  return false;
}

// Mark consumers: DIRTY for direct observers, CHECK below a computed. An effect is queued on its
// first mark; a computed propagates on its first mark only (later marks only raise its state).
// Depth-first in observer order (effects queue in that order), iterative: a computed's observer list
// is entered after saving the current list and position on `marking`/`positions`, so deep computed
// chains do not grow the stack.
const marking: (Node | Node[])[] = [], positions: number[] = [];
function mark(observers: Node | Node[], state: number): void {
  // Fast path: one effect observer (most DOM bindings).
  if (!isArray(observers) && observers.kind !== COMPUTE) {
    const previous = observers.state;
    if (previous < state) {
      observers.state = state;
      if (previous === CLEAN) { queue.push(observers); if (observers.first) nested = true; }
    }
    return;
  }
  const base = marking.length, top = state;
  let list = observers, i = 0;
  walk: for (;;) {
    for (const n = isArray(list) ? list.length : 1; i < n; ) {
      const node = isArray(list) ? list[i] : list;
      i++;
      const previous = node.state;
      if (previous >= state) continue;
      node.state = state;
      if (previous !== CLEAN) continue;
      if (node.kind !== COMPUTE) { queue.push(node); if (node.first) nested = true; }
      else if (node.observers !== null) {
        marking.push(list); positions.push(i);
        list = node.observers; i = 0; state = CHECK;
        continue walk;
      }
    }
    if (marking.length === base) return;
    list = marking.pop()!; i = positions.pop()!;
    state = marking.length === base ? top : CHECK;
  }
}

// Bring a computed or effect up to date: CHECK pulls upstream computeds first and runs only if one
// of them changed (which marks this node DIRTY).
function update(node: Node): void {
  // CHECK exists only below a computed, so `check` is installed by `computed()`.
  if (node.state === CHECK) check!(node);
  if (node.state === DIRTY) run(node);
  else node.state = CLEAN;
}
let check: ((node: Node) => void) | null = null;
// Pull a CHECK node's upstream computeds, depth-first in read order, until one changed (that marks
// the node DIRTY). Iterative: CHECK computeds being examined (and their next source index) wait on
// `checking`/`indexes`, so deep chains do not grow the stack. A DIRTY computed re-runs (marking its
// CHECK consumers DIRTY when it changed); a CHECK one whose sources are all unchanged becomes CLEAN.
const checking: Node[] = [], indexes: number[] = [];
function checkSources(root: Node): void {
  const base = checking.length;
  let node = root, i = 0;
  try {
    for (;;) {
      if (node.state === CHECK) {
        const sources = node.sources, n = count(sources);
        let next: Node | null = null;
        while (i < n) {
          const source = (isArray(sources) ? sources[i] : sources) as Node;
          i++;
          if (source.kind === COMPUTE && !source.disposed && source.state !== CLEAN) {
            if (source.state === CHECK) { next = source; break; }
            run(source);
            if ((node.state as number) === DIRTY) break;
          }
        }
        if (next !== null) { checking.push(node); indexes.push(i); node = next; i = 0; continue; }
      }
      if (checking.length === base) return;
      // A pulled computed: re-run when a source changed, else clean; then resume its consumer.
      if (node.state === DIRTY) run(node); else node.state = CLEAN;
      node = checking.pop()!; i = indexes.pop()!;
    }
  } catch (error) {
    // Only a circular read throws here: nothing on the path is up to date.
    for (;;) {
      if (node.kind === COMPUTE) (node as ComputedNode).fail(error); else node.state = CLEAN;
      if (checking.length === base) break;
      node = checking.pop()!; indexes.pop();
    }
    throw error;
  }
}

// Rethrow the first of several errors; `_flush.report` sees them all.
function fail(errors: unknown[]): never {
  if (errors.length > 1) _flush.report(errors);
  throw errors[0];
}

// Run a node: dispose its children and cleanups, then re-track. An effect rethrows the first failure
// (cleanup errors before its own); a computed caches it (`fail`) and its readers rethrow it.
function run(node: Node): void {
  if (node.disposed) return;
  if (node.flags & RUNNING) throw new Error('Circular computed dependency');
  const previousOwner = currentOwner, previousObserver = currentObserver, compute = node.kind === COMPUTE;
  node.flags |= RUNNING;
  // Cleared first: a write during the run marks the node again and requeues it.
  node.state = CLEAN;
  if (compute) computedDepth++;
  let errors: unknown[] | null = null, value: unknown, done = false;
  // One try (reset collects instead of throwing): a smaller frame per level on deep first reads.
  try {
    if (node.first !== null || node.cleanups !== null) errors = reset(node);
    if (!node.disposed) {
      currentOwner = node; currentObserver = node;
      node.epoch = ++epoch; node.cursor = 0;
      value = node.fn(); done = true;
    }
  } catch (error) { (errors ??= []).push(error); }
  finally {
    // Settle the run's reads (a no-op for a node disposed meanwhile: its links are gone).
    commit(node);
    node.flags &= ~RUNNING;
    if (compute) computedDepth--;
    currentOwner = previousOwner; currentObserver = previousObserver;
  }
  if (!compute) { if (errors !== null) fail(errors); return; }
  if (errors !== null) { if (errors.length > 1) _flush.report(errors); (node as ComputedNode).fail(errors[0]); }
  else if (done) (node as ComputedNode).settle(value);
}

function flush(): void {
  if (batchDepth || flushing || queue.length === 0) return;
  flushing = true;
  // A node whose run epoch is newer than the flush start already ran in this flush.
  const errors: unknown[] = [], start = epoch;
  try {
    // Index loop: work queued while flushing runs in the same pass, in order.
    for (let i = 0; i < queue.length; i++) {
      let node = queue[i];
      if (node.disposed || node.state === CLEAN) continue;
      // Owners first: a dirty owner effect may dispose this node (a zombie child must not run with the
      // values that remove it). The top-most one runs, then this entry is revisited.
      if (nested) node = topDirty(node);
      // Bound repeated work by one effect, not the width of a valid update.
      // Repeat runs within one flush (rare) are counted aside, keeping the count off every node.
      if (node.epoch > start && (repeats ??= new Map()).set(node, (repeats.get(node) ?? 1) + 1).get(node)! > 10000) {
        for (let j = i; j < queue.length; j++) queue[j].state = CLEAN;
        errors.push(new Error('Reactive effect did not settle after 10000 executions'));
        break;
      }
      if (node !== queue[i]) i--;
      try { update(node); } catch (error) { handleError(error, node, errors); }
    }
  } finally { queue.length = 0; flushing = nested = false; repeats = null; if (verified !== null) verified.clear(); }
  if (errors.length) { _flush.report(errors); throw errors[0]; }
}

// The top-most dirty effect at or above `node` (owner-first flush). Short chains walk directly; past LONG
// ancestors the walk continues through `verified`: owners known to have no dirty effect at or above them,
// valid until the queue grows (only a newly queued effect can turn an owner chain dirty), cleared per flush —
// deep trees cost O(owners) per wave instead of O(queued × depth).
const LONG = 32;
let verified: Set<Owner> | null = null, verifiedAt = 0;
const path: Owner[] = [];
function topDirty(node: Node): Node {
  let top = node, parent: Owner | null = node;
  for (let steps = 0; (parent = parent.parent) !== null; )
    if (parent.kind === EFFECT && (parent as Node).state) top = parent as Node;
    else if (++steps === LONG) break;
  if (parent === null) return top;
  if (verified === null) verified = new Set();
  else if (verifiedAt !== queue.length) verified.clear();
  verifiedAt = queue.length;
  let clean = 0;
  for (; parent !== null && !verified.has(parent); parent = parent.parent) {
    path.push(parent);
    if (parent.kind === EFFECT && (parent as Node).state) { top = parent as Node; clean = path.length; }
  }
  for (let i = clean; i < path.length; i++) verified.add(path[i]);
  path.length = 0;
  return top;
}

/** Development ABI: `report` receives every failure of a failed flush (the first is rethrown after);
 * by default each one but the first goes to `reportError` (else `console.error`). */
export const _flush = {
  report: (errors: unknown[]): void => errors.forEach((error, i) => i && (globalThis.reportError || console.error)(error)),
};

function assertWritable(): void {
  if (computedDepth) throw new Error('Signal writes are not allowed during computed evaluation');
}

// A signal is a bound read of its Source; `set`/`update` are shared functions (methods called on the
// signal, not per-signal closures), so a signal costs its Source, one bound function and its properties.
function read(this: Source): unknown { track(this); return this.value; }
/** Set the value, flush affected effects, and return the value. */
function signalSet(this: Getter, value: unknown): unknown {
  assertWritable();
  if (held !== null) held();
  const source = this[SIGNAL]!, equals = source.equals;
  if (equals === null || !equals(source.value, value)) {
    source.value = value;
    if (source.observers !== null) { mark(source.observers, DIRTY); flush(); }
  }
  return source.value;
}
/** Update from the current value without subscribing the caller. */
function signalUpdate(this: Getter & Signal<unknown>, fn: (value: unknown) => unknown): unknown {
  assertWritable();
  const source = this[SIGNAL]!;
  return this.set(untrack(() => fn(source.value)));
}

/** Create a tracked getter with explicit writes; `equals` (default Object.is, false: always notify) skips equal writes.
 * `set`/`update` are methods: call them on the signal (`count.set(1)`), or bind them to pass them on. */
export function signal<T>(): Signal<T | undefined>;
/** `signal([])`: an empty array literal (else inferred `never[]`) is `unknown[]`; prefer `signal<Item[]>([])`. */
export function signal(initial: [], options?: EqualsOptions<unknown[]>): Signal<unknown[]>;
export function signal<T>(initial: T, options?: EqualsOptions<T>): Signal<T>;
export function signal<T>(initial?: T, options?: EqualsOptions<T>): Signal<T> {
  const source = new Source(initial, comparator(options));
  const get = read.bind(source) as Getter & Partial<Signal<unknown>>;
  get.set = signalSet;
  get.update = signalUpdate as Signal<unknown>["update"];
  get[SIGNAL] = source;
  source.getter = get as Signal<unknown>;
  return get as unknown as Signal<T>;
}

// A computed getter is `computedRead` bound to its node (a bound function: no closure + context per computed).
function computedRead(this: ComputedNode): unknown {
  const node = this;
  if (!node.disposed) {
    track(node);
    // DIRTY runs directly (fewest frames per level on a first read of a deep chain).
    if (node.state === DIRTY) run(node); else if (node.state === CHECK) update(node);
  }
  if (node.flags & FAILED) throw node.value;
  return node.value;
}

/** Create a lazy cached tracked getter. Evaluation must be pure: signal writes throw before mutation.
 * Consumers re-run only when the value changes by `equals` (default Object.is; false: always). */
/** @deprecated `computed` of an async function (or a Promise): the result is unusable — see `AsyncFunctionNotAllowed`. */
export function computed<T extends PromiseLike<unknown>>(fn: () => T, options?: EqualsOptions<T>): NotAsync<T, () => T>;
export function computed<T>(fn: () => T, options?: EqualsOptions<T>): () => T;
export function computed<T>(fn: () => T, options?: EqualsOptions<T>): () => T {
  const node = adopt(currentOwner, new ComputedNode(currentOwner, fn, comparator(options)));
  check = checkSources;
  computedPin ??= new ComputedNode(null, Object, null);
  const get = computedRead.bind(node) as Getter;
  get[COMPUTED] = node;
  // The getter exposes this owner through graph views, even after its containing scope is disposed.
  observeOwner(node);
  return get as () => T;
}

// Keyed selector (Solid `createSelector`): one watcher effect over `source` plus observer-only per-key sources
// (`KeySource`) of the tracking readers. A source change marks only the readers whose key's `fn(key, value)`
// changed (with the default `fn` only the previous and next value's keys can; else the keys the
// `keys(next, previous)` hint lists, or every key): O(changed) per change through the `subs` index (key → chain
// of sources, `same`). Subscribing never hashes: a new key's source is appended to `pending` (a 1000-row list
// subscribes 1000 keys inside one click; a hash insert per row was half a krausest row's selector cost) and the
// index takes the pending sources in a later task (`fold`, scheduled once per batch of new keys); a change arriving
// before that also scans `pending` (cheap compares), so it never misses a reader. Readers of one key read in a
// row (an option's several bindings; every item's `isSelectionEmpty` key 0) share its source (`last`), an indexed
// key's readers share its head, and a reader's re-run keeps its own (the tracking cursor's next link). The watcher
// has no owner: it is created by the first tracked read and lives while keys are observed — a sweep (every
// SWEEP-th change, and when `pending` doubles) drops unobserved sources and disposes the watcher once none is
// left, so no reader can miss a change and nothing outlives its readers by more than SWEEP changes. Untracked
// reads and `_trackReads` collectors read `source` directly (resume regions record the source signal, not the
// keys).
const SWEEP = 16;
const KEY: Equals = () => false;
// Getter-less, `value` = its Selector: `_trackReads` walks a computed reading it through to the watcher.
// `equals` = the `KEY` sentinel (never called: key sources are never written): `unsubscribeLast` reports a key
// source losing its last reader to the selector, whose next fold prunes the index (`dead`).
class KeySource extends Source {
  declare key: unknown;
  declare same: KeySource | null;
  constructor(selector: Selector, key: unknown) {
    super(selector, KEY);
    this.key = key;
    this.same = null;
  }
}
class Selector {
  declare source: () => unknown;
  declare fn: (key: unknown, value: unknown) => unknown;
  declare keys: ((next: unknown, previous: unknown) => Iterable<unknown> | null | undefined) | null;
  declare node: Node | null;
  declare value: unknown;
  declare subs: Map<unknown, KeySource>;
  declare pending: KeySource[];
  declare last: KeySource | null;
  declare folding: boolean;
  declare limit: number;
  declare runs: number;
  declare dead: boolean;
  constructor(source: () => unknown, fn: (key: unknown, value: unknown) => unknown, keys: Selector['keys']) {
    this.source = source;
    this.fn = fn;
    this.keys = keys;
    this.node = null;
    this.value = undefined;
    this.subs = new Map();
    this.pending = [];
    this.last = null;
    this.folding = false;
    this.limit = 64;
    this.runs = 0;
    this.dead = false;
  }
  // A key source lost its last reader (row disposed): one fold per batch of drops prunes the index, so keys of
  // removed readers never accumulate between selection changes (run / clear cycles without a selection).
  dropped(): void {
    this.dead = true;
    if (!this.folding) { this.folding = true; later(foldTask.bind(null, this)); }
  }
}
const isKey = (key: unknown, value: unknown): boolean => key === value;
// SameValueZero (Map / Set key equality: NaN matches NaN).
const sameKey = (a: unknown, b: unknown): boolean => a === b || (a !== a && b !== b);
// Default `keys` with the default `fn`: only the previous and the next value's keys can change result
// (Solid `createSelector`); `selectorRun` looks the two up directly instead of calling it.
const pairKeys = (next: unknown, previous: unknown): Iterable<unknown> => [next, previous];
// The fold runs in a timer task after the one that subscribed (not an idle callback: a selection change soon after
// a mount would scan every pending source first — cdk ListBox first update 0.06 → 0.14 ms with idle callbacks).
const later = (fn: () => void): void => {
  (setTimeout(fn, 0) as unknown as { unref?: () => void }).unref?.();
};
// Index the pending sources still observed (behind a live head of the same key: one chain per key). After
// readers left (`dead`), first drop the unobserved sources from the index; nothing observed → the watcher goes.
function fold(selector: Selector): void {
  selector.folding = false;
  const pending = selector.pending, subs = selector.subs;
  if (selector.dead) {
    selector.dead = false;
    for (const [key, head] of subs) {
      let live: KeySource | null = null, last: KeySource | null = null;
      for (let source: KeySource | null = head; source !== null; source = source.same) {
        if (source.observers === null) continue;
        if (last === null) live = source; else last.same = source;
        last = source;
      }
      if (last === null) subs.delete(key);
      else { last.same = null; if (live !== head) subs.set(key, live!); }
    }
    if (selector.last !== null && selector.last.observers === null) selector.last = null;
  }
  for (let i = 0; i < pending.length; i++) {
    const source = pending[i];
    if (source.observers === null) continue;
    const head = subs.get(source.key);
    if (head === undefined) subs.set(source.key, source);
    else if (head !== source) { source.same = head.same; head.same = source; }
  }
  pending.length = 0;
}
// The scheduled fold (a timer task, outside the watcher's run): no key observed any more → dispose the watcher too
// (re-created by the next tracked read, as after a sweep).
function foldTask(selector: Selector): void {
  fold(selector);
  const node = selector.node;
  if (selector.subs.size === 0 && node !== null && node.state === CLEAN) { selector.node = null; selector.runs = 0; selector.last = null; dispose(node); }
}
function selectorRun(this: Selector): void {
  const next = this.source(), previous = this.value;
  this.value = next;
  // First run: the watcher is created by a read, nothing was subscribed before it.
  if (this.runs++ === 0 || Object.is(next, previous)) return;
  // The diff is untracked: `fn` / `keys` reads do not subscribe the watcher.
  currentObserver = null;
  const subs = this.subs, fn = this.fn, pending = this.pending;
  if (this.runs % SWEEP === 0) {
    fold(this);
    for (const [key, source] of subs) notifyKey(subs, fn, key, source, next, previous);
    if (subs.size === 0) { const node = this.node!; this.node = null; this.runs = 0; this.last = null; dispose(node); }
    return;
  }
  if (this.keys === pairKeys) {
    let source = subs.get(next);
    if (source !== undefined) notifyKey(subs, fn, next, source, next, previous);
    if ((source = subs.get(previous)) !== undefined) notifyKey(subs, fn, previous, source, next, previous);
    if (pending.length !== 0) scanPending(pending, fn, next, previous, next, previous, null, null, false);
    return;
  }
  const hint = this.keys === null ? null : this.keys(next, previous);
  if (hint == null) {
    for (const [key, source] of subs) notifyKey(subs, fn, key, source, next, previous);
    if (pending.length !== 0) scanPending(pending, fn, next, previous, undefined, undefined, null, null, true);
    return;
  }
  const keys = pending.length === 0 || isArray(hint) ? hint : [...hint];
  for (const key of keys) { const source = subs.get(key); if (source !== undefined) notifyKey(subs, fn, key, source, next, previous); }
  if (pending.length !== 0) {
    const list = keys as unknown[];
    if (list.length <= 8) scanPending(pending, fn, next, previous, undefined, undefined, list, null, false);
    else scanPending(pending, fn, next, previous, undefined, undefined, null, new Set(list), false);
  }
}
// Notify a key's live sources when its result changed; unobserved ones leave the chain (and the index).
function notifyKey(subs: Map<unknown, KeySource>, fn: Selector['fn'], key: unknown, head: KeySource, next: unknown, previous: unknown): void {
  let live: KeySource | null = null, last: KeySource | null = null, changed: boolean | undefined;
  for (let source: KeySource | null = head; source !== null; source = source.same) {
    if (source.observers === null) continue;
    if (last === null) live = source; else last.same = source;
    last = source;
    changed ??= !Object.is(fn(key, next), fn(key, previous));
    if (changed) mark(source.observers, DIRTY);
  }
  if (last === null) { subs.delete(key); return; }
  last.same = null;
  if (live !== head) subs.set(key, live!);
}
// A change before the fold: the not yet indexed sources whose key may have changed — `a` / `b` (pair), one of
// `keys` (a small hint: compared inline), in `only` (a larger hint), or every key (all null). Plain compare loops.
function scanPending(pending: KeySource[], fn: Selector['fn'], next: unknown, previous: unknown, a: unknown, b: unknown, keys: unknown[] | null, only: Set<unknown> | null, all: boolean): void {
  for (let i = 0; i < pending.length; i++) {
    const source = pending[i], key = source.key;
    if (source.observers === null) continue;
    if (!all) {
      if (keys === null && only === null) { if (!sameKey(key, a) && !sameKey(key, b)) continue; }
      else if (only !== null) { if (!only.has(key)) continue; }
      else { let hit = false; for (let k = 0; k < keys!.length; k++) if (sameKey(keys![k], key)) { hit = true; break; } if (!hit) continue; }
    }
    if (!Object.is(fn(key, next), fn(key, previous))) mark(source.observers, DIRTY);
  }
}
function selectorRead(this: Selector, key: unknown): unknown {
  const observer = currentObserver;
  if (observer === null || observer.disposed) return this.fn(key, this.source());
  // A `_trackReads` collector (server regions): the source's signals, or the keyed read (`collectKey`).
  if (observer.kind === COLLECTOR) return observer.key(this, key);
  let node = this.node;
  if (node === null) run((node = this.node = adopt(null, new Node(EFFECT, null, selectorRun.bind(this)))));
  else if (node.state !== CLEAN) update(node); // written inside a batch: catch up before this read
  // A re-run reading the same key at the same position keeps its source (the tracking cursor's next link).
  const at = observer.cursor, sources = observer.sources;
  let source = (at >= 0 && sources !== null ? (isArray(sources) ? sources[at] : at === 0 ? sources : undefined) : undefined) as KeySource | undefined;
  if (source === undefined || source.value !== this || !sameKey(source.key, key)) {
    const last = this.last;
    if (last !== null && last.observers !== null && sameKey(last.key, key)) source = last;
    else if ((source = this.subs.size === 0 ? undefined : this.subs.get(key)) === undefined) {
      const pending = this.pending;
      // Amortized sweep of sources nobody observes any more (removed rows) before the fold.
      if (pending.length >= this.limit) {
        let j = 0;
        for (let i = 0; i < pending.length; i++) if (pending[i].observers !== null) pending[j++] = pending[i];
        pending.length = j;
        this.limit = Math.max(64, j * 2);
      }
      pending.push((source = new KeySource(this, key)));
      if (!this.folding) { this.folding = true; later(foldTask.bind(null, this)); }
    }
    this.last = source;
  }
  track(source);
  return this.fn(key, this.value);
}

/** `selector` `keys` hint for Set-valued sources (a selection): the keys in exactly one of `next` / `previous`; null
 * (every key) unless both are Sets. Known to resume (`_trackReads` keyed reads): lazy collection rows reading
 * `selector(signal, fn, { keys: memberKeys })` wake per key. */
export function memberKeys<K>(next: unknown, previous: unknown): K[] | null {
  if (!(next instanceof Set) || !(previous instanceof Set)) return null;
  const keys: K[] = [];
  for (const key of next) if (!previous.has(key)) keys.push(key);
  for (const key of previous) if (!next.has(key)) keys.push(key);
  return keys;
}

/** Create a keyed selector (Solid `createSelector`): `select(key)` returns `fn(key, source())` (default
 * `key === source()`), but a tracking reader re-runs only when its own key's result changes — a selection
 * change in a 1000-row list notifies the two changed rows, not 1000. `options.keys(next, previous)` may list
 * the keys whose result can differ (e.g. the symmetric difference of two Sets): only those are compared
 * (null / undefined: every subscribed key; with the default `fn`, the previous and the next value only). Untracked reads read `source` directly. Inside a batch, a reader
 * evaluated before the flush sees the new value; a computed cached before the write (not re-evaluated) keeps
 * its value until the batch flushes. Owner-free: the internal watcher lives while tracked readers exist. */
export function selector<T, K = T, R = boolean>(
  source: () => T,
  fn?: (key: K, value: T) => R,
  options?: { keys?: (next: T, previous: T) => Iterable<K> | null | undefined },
): (key: K) => R {
  const keys = options?.keys;
  return selectorRead.bind(new Selector(source, (fn ?? isKey) as Selector['fn'], (keys ?? (fn ? null : pairKeys)) as Selector['keys'])) as (key: K) => R;
}

// Effect disposers are `disposeThis` bound to the node (no closure + context per effect).
function disposeThis(this: Owner): void { dispose(this); }

// Run `fn(a, b, c, d)` in a batch, then flush; the first failure (fn's, else the flush's) is rethrown.
function batched<A, B, C, D, R>(fn: (a: A, b: B, c: C, d: D) => R, a: A, b?: B, c?: C, d?: D): R {
  if (held !== null) held();
  batchDepth++;
  let value: R | undefined, failure: unknown; let failed = false;
  try { value = fn(a, b!, c!, d!); } catch (error) { failed = true; failure = error; }
  finally { batchDepth--; }
  try { flush(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return value as R;
}
// A failed initialization disposes the effect (idempotent) and rethrows the first failure.
function runOrDispose(node: Node): void {
  try { run(node); } catch (error) {
    try { dispose(node); } catch { /* Preserve the initialization error. */ }
    throw error;
  }
}
function initializeEffect(node: Node): void {
  // Already batching or flushing (every nested effect): the batch's flush would be a no-op, so run directly —
  // in this frame (one frame less per nested reactive level: deeper trees before a stack overflow).
  if (batchDepth || flushing) try { run(node); } catch (error) {
    try { dispose(node); } catch { /* Preserve the initialization error. */ }
    throw error;
  }
  else try { batched(runOrDispose, node); } catch (error) {
    try { dispose(node); } catch { /* Preserve the first effect failure. */ }
    throw error;
  }
}

/** Run a tracked effect immediately; rerun cleanup errors surface after resubscribing. Return its disposer. */
/** @deprecated `effect` of an async function (or a Promise): see `AsyncFunctionNotAllowed`. */
export function effect<R extends PromiseLike<unknown>>(fn: () => R): NotAsync<R, Disposer>;
export function effect(fn: () => void): Disposer;
export function effect(fn: () => void): Disposer {
  const node = reactive(fn);
  initializeEffect(node);
  return disposeThis.bind(node);
}

/** @internal DOM binding effect: retain observable owners, release successfully initialized inert leaves. */
export function _bindingEffect(fn: () => void): void {
  const node = reactive(fn);
  if (observedBindings) {
    initializeEffect(node);
    return;
  }
  const seen = observations;
  // initializeEffect inlined (one frame less per nested binding level).
  try { if (batchDepth || flushing) run(node); else batched(runOrDispose, node); }
  catch (error) {
    try { dispose(node); } catch { /* Preserve the initialization error. */ }
    throw error;
  }
  if (!observedBindings && observations === seen && !node.disposed && node.sources === null &&
      node.first === null && node.cleanups === null && node.state === CLEAN && !(node.flags & RUNNING))
    dispose(node);
}

let argPin: Owner | null = null;
/** @internal DOM binding effect without a closure (compiled templates): the binding is a module-level `fn`,
 * run as `fn(a, b, c)` with its captures. Same lifetime and release rule as `_bindingEffect`. */
export function _bindingEffect1<A, B, C>(fn: (a: A, b: B, c: C) => void, a: A, b?: B, c?: C): void {
  // Shape pin (see `adopt`): one parentless instance keeps the class map alive.
  argPin ??= new ArgNode(null, Object, null, null, null);
  const node = adopt(currentOwner, wrapEffect === null
    ? new ArgNode(currentOwner, fn as (a: unknown, b: unknown, c: unknown) => unknown, a, b, c)
    : new ArgNode(currentOwner, wrapEffect(() => fn(a, b!, c!)), undefined, undefined, undefined));
  if (observedBindings) {
    initializeEffect(node);
    return;
  }
  const seen = observations;
  // initializeEffect inlined (one frame less per nested binding level).
  try { if (batchDepth || flushing) run(node); else batched(runOrDispose, node); }
  catch (error) {
    try { dispose(node); } catch { /* Preserve the initialization error. */ }
    throw error;
  }
  if (!observedBindings && observations === seen && !node.disposed && node.sources === null &&
      node.first === null && node.cleanups === null && node.state === CLEAN && !(node.flags & RUNNING))
    dispose(node);
}

/** @internal Runtime ABI (server-resume): wrap the function of every effect created from now on (null
 * clears) — e.g. bind it to the creating request's AsyncLocalStorage context, so a re-run triggered by
 * another request's write records into its own request. Returns the previous wrapper. */
export function _wrapEffects(wrap: ((fn: () => unknown) => () => unknown) | null): ((fn: () => unknown) => () => unknown) | null {
  const previous = wrapEffect;
  wrapEffect = wrap;
  return previous;
}

/** @internal Debug tools retain internal binding owners once graph inspection is available. */
export function _observeBindings(): void { observedBindings = true; }

// Any hand-out during a binding's initialization keeps that binding (and every binding initializing around it):
// a captured descendant, even one disposed before initialization finishes, exposes its ancestors. Conservative
// for an unrelated owner (`runWithOwner(other, getOwner)`): the inert binding then lives until its owner goes.
function observeOwner(_owner: Owner | null): void {
  observations++;
}
/** @internal Mark owner identities returned by development graph views as externally observable. */
export const _observeOwner = observeOwner as (owner: OwnerHandle | null) => void;

/** Defer effects until the outer synchronous batch exits, including on failure. */
export function batch<T>(fn: () => T): T {
  return batched(fn as (a: undefined) => T, undefined);
}

/** Execute in a fresh scope and return its value and idempotent disposer. The scope is a child of the
 * current owner (disposed with it, context visible) — unlike Solid, whose roots are detached. */
export function createRoot<T>(fn: (dispose: Disposer) => T): { value: T; dispose: Disposer } {
  const node = owner(); const stop = () => dispose(node);
  const previousOwner = currentOwner, previousObserver = currentObserver;
  // A resume read collector sees through roots: server regions record reads made while constructing.
  currentOwner = node; currentObserver = keepCollector(currentObserver);
  try { return { value: fn(stop), dispose: stop }; }
  catch (error) { try { stop(); } catch { /* Preserve initialization failure. */ } throw error; }
  finally { currentOwner = previousOwner; currentObserver = previousObserver; }
}

/**
 * @internal Runtime ABI (list rows): run `fn(holder)` in a new root under `parent`, storing the root
 * in `holder.owner` before `fn` runs. No disposer closure or result object; dispose with `_dispose`.
 */
export function _rootIn<H extends { owner: OwnerHandle | null }, R>(parent: OwnerHandle | null, fn: (holder: H) => R, holder: H): R {
  if ((parent as unknown as Owner | null)?.disposed) throw new Error('Cannot run with a disposed owner');
  const node = owner(parent as unknown as Owner | null);
  holder.owner = node as unknown as OwnerHandle;
  const previousOwner = currentOwner, previousObserver = currentObserver;
  currentOwner = node; currentObserver = keepCollector(currentObserver);
  try { return fn(holder); }
  catch (error) { try { dispose(node); } catch { /* Preserve initialization failure. */ } throw error; }
  finally { currentOwner = previousOwner; currentObserver = previousObserver; }
}

/**
 * @internal Runtime ABI (DOM v2 `_scoped`, cdk live collection content): `fn` as an accessor for a later
 * reader (an insertion effect) that runs each read in a fresh child scope of the creation owner — context
 * lookups see the providers around the creation site — while the reader keeps tracking `fn`'s reads.
 * The previous read's scope is disposed on the next read and with the reader. No owner: `fn` itself.
 */
export function _scoped<T>(fn: () => T): () => T {
  const parent = currentOwner;
  if (parent === null) return fn;
  let scope: Owner | null = null;
  return () => {
    if (scope !== null) { const previous = scope; scope = null; dispose(previous); }
    if (parent.disposed) return fn();
    const node = owner(parent), previousOwner = currentOwner;
    currentOwner = node;
    let value: T;
    try { value = fn(); }
    catch (error) { try { dispose(node); } catch { /* Preserve the read failure. */ } throw error; }
    finally { currentOwner = previousOwner; }
    scope = node;
    if (previousOwner !== null && !previousOwner.disposed) onCleanup(() => dispose(node));
    return value;
  };
}

/** @internal Runtime ABI: dispose a root created by `_rootIn` (idempotent). */
export function _dispose(root: OwnerHandle | null): void { if (root) dispose(root as unknown as Owner); }

/** @internal Runtime ABI (server streaming): `root` leaves its parent, whose disposal then no longer disposes it — its
 * own disposer does. Context and catchError lookups are unchanged (frames, not parent links). A disposed root is
 * already unlinked (a dropped segment can dispose its root before the boundary detaches it). */
export function _detach(root: OwnerHandle | null): void {
  const node = root as unknown as Owner | null;
  if (node && !node.disposed) { unlink(node); node.parent = null; }
}

/** @internal Runtime ABI: the owner of the running binding (its parent), for state that outlives a run. */
export function _bindingOwner(): OwnerHandle | null {
  return (currentOwner?.parent ?? null) as unknown as OwnerHandle | null;
}

/**
 * @internal Runtime ABI (every DOM event handler): call `handler` on `target` with `event`, batched, under
 * `owner` (context lookups see it); nothing runs once the owner is disposed. The first trusted mouse `click`
 * (`isTrusted`, `pointerType` "mouse") per document whose handlers queue effects, outside a batch, defers
 * the batch's flush to a task posted now (later clicks flush synchronously);
 * `onError` then receives that flush's failure (default `reportError`). A pending deferred flush runs
 * first whenever another event is dispatched, a batch starts or a signal is written outside a batch.
 */
export function _dispatch(
  owner: OwnerHandle | null,
  handler: (event: Event) => unknown,
  target: unknown,
  event: Event,
  onError?: (error: unknown) => void,
): void {
  const node = owner as unknown as Owner | null;
  if (node !== null && node.disposed) return;
  // Another event: the previous click's DOM updates land before its handlers run.
  if (held !== null && event !== heldEvent) held();
  // Chrome (headless + headed) stalls the frame after the first mouse click of a tab whose task changed the DOM
  // (main thread idle in BeginMainFrame ~25–45 ms; click→paint p50 headless 45–62 ms sync vs 32 ms with the DOM
  // write one task later, headed 47 vs 13). Once a click's DOM change landed, later clicks paint in ~1 frame
  // when synchronous and ~2 deferred (headless 16 vs 32 ms, headed 6 vs 13): so only the first mouse click per
  // document (`view`) whose handlers queued effects defers. Only the flush moves: the handler, its
  // preventDefault / stopPropagation and signal writes (reads see new values) stay synchronous. Keyboard /
  // touch / pen / synthetic clicks measured no stall (touch: deferring is slower): they flush now.
  const view = (event as UIEvent).view;
  if (batchDepth || flushing || !event.isTrusted || event.type !== 'click' || (event as PointerEvent).pointerType !== 'mouse' || !view ||
      (event !== heldEvent && settled !== null && settled.has(view))) {
    batched(callIn, node, handler, target, event);
    return;
  }
  // Handlers of the same event (bubbling path, a taken-over spread) share one deferred flush.
  held = null;
  batchDepth++;
  try { callIn(node, handler, target, event); }
  finally {
    batchDepth--;
    if (queue.length) hold(event, view, onError);
  }
}
// True while a deferred click's flush runs (`release`).
let releasing = false;
/**
 * @internal Runtime ABI (DOM removal): whether the running flush is a deferred first mouse click's. Chrome also
 * stalls the frame after that click when its update detaches the hovered element (content replaced under the
 * pointer: a navigation); DOM v2 removals then keep that element until the next frame, hidden (`dom-v2.ts` `drop`).
 */
export function _deferredFlush(): boolean { return releasing; }
let heldEvent: Event | null = null, heldError: ((error: unknown) => void) | undefined, port: MessagePort | null = null;
// Documents (windows) whose first DOM-changing mouse click was deferred: their later clicks flush synchronously.
let settled: WeakSet<object> | null = null;
// Keep the click's queued effects for a task posted now (MessageChannel: no timer clamping, before rAF).
function hold(event: Event, view: object, onError: ((error: unknown) => void) | undefined): void {
  (settled ??= new WeakSet()).add(view);
  if (heldEvent !== event || heldError === undefined) heldError = onError;
  held = release;
  heldEvent = event;
  if (port === null) {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { if (held !== null) held(); };
    // Node: an idle port must not keep the process alive.
    (channel.port1 as MessagePort & { unref?: () => void }).unref?.();
    port = channel.port2;
  }
  port.postMessage(0);
}
// Flush a deferred event's effects now. Failures surface like a synchronous handler's: owner handlers in
// the flush, the rest to the dispatcher's `onError`, else `reportError` (never into an unrelated caller).
function release(): void {
  const report = heldError ?? globalThis.reportError ?? console.error;
  held = heldEvent = null;
  heldError = undefined;
  releasing = true;
  try { flush(); } catch (error) { report(error); }
  finally { releasing = false; }
}

/** @internal Runtime ABI (test helpers): run a deferred event flush now (no-op when none is pending). */
export function _settle(): void { if (held !== null) held(); }
function callIn(node: Owner | null, handler: (event: Event) => unknown, target: unknown, event: Event): void {
  const previousOwner = currentOwner, previousObserver = currentObserver;
  currentOwner = node; currentObserver = null;
  try { handler.call(target, event); } finally { currentOwner = previousOwner; currentObserver = previousObserver; }
}

/** @internal Runtime ABI: whether a read now would be tracked (lazy sources). */
export function _tracking(): boolean { return currentObserver !== null; }

/** Register cleanup for the current owner or effect run; reject unowned use and non-functions. */
export function onCleanup(fn: Disposer): void {
  if (!currentOwner || currentOwner.disposed) throw new Error('onCleanup requires a live owner');
  if (typeof fn !== 'function') throw new TypeError('onCleanup requires a function');
  const callbacks = currentOwner.cleanups;
  // Most owners register one cleanup. Avoid its array (and the first push's spare capacity),
  // then promote to an exact pair only when a second callback is registered.
  if (callbacks === null) currentOwner.cleanups = fn;
  else if (typeof callbacks === 'function') currentOwner.cleanups = [callbacks, fn];
  else callbacks.push(fn);
}

/** @internal Runtime ABI: `fn(arg)` untracked, without a wrapper closure (compiled component calls). */
export function _untrack1<A, R>(fn: (arg: A) => R, arg: A): R {
  const previous = currentObserver; currentObserver = null;
  try { return fn(arg); } finally { currentObserver = previous; }
}

/** @internal Runtime ABI (cdk collection build pass): the current observer, opaque; pass to `_reobserve`. */
export function _observer(): object | null {
  return currentObserver;
}

/**
 * @internal Runtime ABI: run `fn` with `observer` (from `_observer()`) as the current observer — re-enter a
 * tracking scope from an untracked component body. Only while that observer is still running synchronously.
 */
export function _reobserve<T>(observer: object | null, fn: () => T): T {
  const previous = currentObserver; currentObserver = observer as Node | Collector | null;
  try { return fn(); } finally { currentObserver = previous; }
}

/** Execute synchronously without recording reactive dependencies. */
export function untrack<T>(fn: () => T): T {
  const previous = currentObserver; currentObserver = null;
  try { return fn(); } finally { currentObserver = previous; }
}

/** Create an identity token with a default value; `id` names it for resumable state. */
export function createContext<T>(defaultValue: T, options?: { id?: string }): Context<T> {
  return Object.freeze(options?.id === undefined ? { defaultValue } : { defaultValue, id: String(options.id) });
}

/** Execute with a logical context provider inherited by its owned descendants. */
export function provide<T, R>(token: Context<T>, value: T, fn: () => R): R {
  if (provideObserver !== null && token.id !== undefined) provideObserver(token, value);
  const node = owner(); node.ctx = { token: token as Context<unknown>, value, up: node.ctx, owner: node, memo: null };
  const previous = currentOwner; currentOwner = node;
  try { return fn(); }
  catch (error) { try { dispose(node); } catch { /* Preserve callback failure. */ } throw error; }
  finally { currentOwner = previous; }
}

/** Run fn under an error handler: its synchronous throw, and later effect/computed failures of its
 * descendants during a flush, go to `handler`; a throwing handler forwards to the next one up. The
 * handler runs under the catchError scope (context lookups, `getOwner()`), untracked. A synchronous
 * throw first disposes what `fn` built before it (no half-built subtree stays alive). Synchronous
 * only: a promise `fn` returns is not observed (its rejection does not reach `handler`). */
export function catchError<T>(fn: () => T, handler: (error: unknown) => void): T | undefined {
  // The handler rides the owner's context fields; handleError itself is the private token.
  const node = owner(); node.ctx = { token: handleError as never, value: handler, up: node.ctx, owner: node, memo: null };
  try { return runWithOwner(node as unknown as OwnerHandle, fn); } catch (error) {
    const errors = reset(node);
    if (errors !== null) _flush.report([error, ...errors]);
    handleError(error, node);
  }
}
// Nearest catchError handler from `node` up takes the error; unhandled: pushed to `errors`, else thrown.
function handleError(error: unknown, node: Owner | null, errors?: unknown[]): void {
  for (let frame = node === null ? null : node.ctx; frame !== null; frame = frame.up)
    if (frame.token === (handleError as never)) {
      const previousOwner = currentOwner, previousObserver = currentObserver;
      currentOwner = frame.owner; currentObserver = null;
      try { return (frame.value as (error: unknown) => void)(error); } catch (next) { error = next; }
      finally { currentOwner = previousOwner; currentObserver = previousObserver; }
    }
  if (!errors) throw error;
  errors.push(error);
}
/** Runtime ABI: route an error to the catchError handlers above a captured owner; rethrow when unhandled. */
export const _handleError = handleError as (error: unknown, owner: OwnerHandle | null) => void;

/** Read the nearest logical provider, or the token's default, synchronously. */
export function useContext<T>(token: Context<T>): T {
  // Walks the providers above (frames), not every owner: O(providers between), independent of depth.
  const start = currentOwner === null ? null : currentOwner.ctx;
  if (start === null) return token.defaultValue;
  if (start.memo !== null) {
    const hit = start.memo.get(token as Context<unknown>);
    if (hit !== undefined) return (hit === null ? token.defaultValue : hit.value) as T;
  }
  let frame: Frame | null = start;
  for (let steps = 0; frame !== null; frame = frame.up, steps++)
    if (frame.token === token || steps === MEMO) break;
  if (frame !== null && frame.token !== token) frame = remember(start, frame, token as Context<unknown>);
  return (frame === null ? token.defaultValue : frame.value) as T;
}

// Finish a long lookup from `frame` and memoize it on `start`.
function remember(start: Frame, frame: Frame | null, token: Context<unknown>): Frame | null {
  while (frame !== null && frame.token !== token) frame = frame.up;
  (start.memo ??= new Map()).set(token, frame);
  return frame;
}

/** Capture the current opaque owner, or null outside any owned scope. */
export function getOwner(): OwnerHandle | null {
  observeOwner(currentOwner);
  return currentOwner as unknown as OwnerHandle | null;
}

/** Restore an owner for a synchronous callback; reject disposed owners. */
export function runWithOwner<T>(capturedOwner: OwnerHandle | null, fn: () => T): T {
  if ((capturedOwner as unknown as Owner | null)?.disposed) throw new Error('Cannot run with a disposed owner');
  const previousOwner = currentOwner, previousObserver = currentObserver;
  currentOwner = capturedOwner as unknown as Owner | null; currentObserver = keepCollector(currentObserver);
  try { return fn(); }
  finally { currentOwner = previousOwner; currentObserver = previousObserver; }
}

// Dedupe by linear scan up to this many entries, then by a Set (most bindings read 1–3 signals).
const SCAN = 16;
const EMPTY: Signal<unknown>[] = Object.freeze([]) as never;
// Append `item` unless present; returns the (possibly promoted) index Set.
function unique(list: unknown[], index: Set<unknown> | null, item: unknown): Set<unknown> | null {
  if (index !== null) { if (index.has(item)) return index; index.add(item); }
  else if (list.includes(item)) return null;
  else if (list.length === SCAN) (index = new Set(list)).add(item);
  list.push(item);
  return index;
}
// The collector's `add` (track() calls `node.add(source)`): one shared function, no closure per
// `_trackReads` call; referenced only from `_trackReads`, so bundles without it drop `collect` too.
function collectThis(this: Collector, source: Tracked): void {
  collect(this, source);
}
// A selector read inside the collector (`selectorRead`): reported to the keyed hook when the wake can be the key's own —
// the source is a signal and the selector's change hint one resume knows (`KeyedRead` kinds) — and then read without
// listing the signal; otherwise the source's reads are the collector's, as any read.
function collectKey(this: Collector, selector: Selector, key: unknown): unknown {
  if (this.keyed === null || !keyedRead(this.keyed, selector, key)) return selector.fn(key, selector.source());
  currentObserver = null;
  try { return selector.fn(key, selector.source()); }
  finally { currentObserver = this; }
}
function keyedRead(keyed: KeyedRead, selector: Selector, key: unknown): boolean {
  const source = selector.source as Getter, kind = selector.keys === pairKeys ? 0 : selector.keys === memberKeys ? 1 : -1;
  return kind >= 0 && source[SIGNAL] !== undefined && source[SIGNAL].getter === source && keyed(source as Signal<unknown>, kind as 0 | 1, key);
}
function collect(collector: Collector, source: Tracked): void {
  let item: Getter | Node;
  if (source.kind === SOURCE) item = (source as Source).getter!;
  else { item = source as Node; collector.computed = true; }
  if (collector.reads === null) collector.reads = [item];
  else collector.index = unique(collector.reads, collector.index, item);
}
// Leaf signals below the collected reads, depth-first in first-read order (computeds visited once).
interface Walk { signals: Signal<unknown>[]; index: Set<unknown> | null; visited: Node[]; vindex: Set<unknown> | null; keyed: KeyedRead | null }
function walk(state: Walk, item: Getter | Tracked): void {
  if (typeof item === "function") state.index = unique(state.signals, state.index, item);
  else if (item.kind === SOURCE) {
    const getter = (item as Source).getter;
    if (getter !== null) state.index = unique(state.signals, state.index, getter);
    // A `selector` key source (no getter, `value` = its Selector): keyed (the collector's hook took it), else the signals
    // behind it are its watcher's.
    else {
      const selector = (item as Source).value as Selector;
      if (state.keyed !== null && keyedRead(state.keyed, selector, (item as KeySource).key)) return;
      const watcher = selector.node; if (watcher !== null) walk(state, watcher);
    }
  }
  else {
    const visited = state.visited, length = visited.length;
    state.vindex = unique(visited, state.vindex, item);
    if (visited.length === length) return;
    const sources = (item as Node).sources;
    if (sources === null) return;
    if (!isArray(sources)) walk(state, sources);
    else for (let i = 0; i < sources.length; i++) walk(state, sources[i]);
  }
}

/** Resume ABI: run fn untracked by the caller and report the signals it read, through computeds.
 * `signals` is read-only (a shared frozen empty array when nothing was read). `arg` is passed to fn
 * (compiled server attribute reads are module-level functions over their captures array). */
export function _trackReads<T, A = undefined>(fn: (arg: A) => T, arg?: A, keyed?: KeyedRead | null): { value: T; signals: Signal<unknown>[] } {
  const collector: Collector = { kind: COLLECTOR, disposed: false, add: collectThis, key: collectKey, keyed: keyed ?? null, reads: null, index: null, computed: false };
  const previousObserver = currentObserver;
  currentObserver = collector;
  let value: T;
  try { value = fn(arg as A); }
  finally { currentObserver = previousObserver; }
  const reads = collector.reads;
  if (reads === null) return { value, signals: EMPTY };
  if (!collector.computed) return { value, signals: reads as Signal<unknown>[] };
  const state: Walk = { signals: [], index: null, visited: [], vindex: null, keyed: collector.keyed };
  for (let i = 0; i < reads.length; i++) walk(state, reads[i]);
  return { value, signals: state.signals.length ? state.signals : EMPTY };
}

type RegionStateHook = <T>(create: () => T) => T;
let regionStateHook: RegionStateHook | null = null;
/**
 * Resume ABI: state a component creates for itself (`create()`), e.g. an uncontrolled value signal. A
 * resumable server render records it with the region whose read created it; when the resumed page
 * re-creates that region (on the first change of a signal the server read), the re-created component
 * gets the server's (revived, possibly since changed) value back instead of a fresh one.
 */
export function _regionState<T>(create: () => T): T {
  return regionStateHook === null ? create() : regionStateHook(create);
}
/**
 * Resume ABI: `start` (filled by `@rivetjs/motion/layout`, null otherwise) is called when dom-resume activates a
 * binding whose chunks are still loading (a region the first interaction re-creates); the returned function runs once
 * that activation ran or failed.
 */
export const _activating: { start: (() => () => void) | null } = { start: null };
/** Resume ABI: set the `_regionState` hook (server-resume records, dom-resume adopts); returns the previous one. */
export function _setRegionStateHook(hook: RegionStateHook | null): RegionStateHook | null {
  const previous = regionStateHook;
  regionStateHook = hook;
  return previous;
}

/** Resume ABI: classify a reactive getter without reading it; `equals` is Object.is by default, null for `equals: false`. */
export function _inspect(fn: unknown):
  | { kind: 'signal'; value: unknown; equals: Equals }
  | { kind: 'computed'; equals: Equals }
  | null {
  if (typeof fn !== 'function') return null;
  const source = (fn as Getter)[SIGNAL];
  if (source !== undefined && source.getter === fn) return { kind: 'signal', value: source.value, equals: source.equals };
  if ((fn as Getter)[COMPUTED] !== undefined) return { kind: 'computed', equals: (fn as Getter)[COMPUTED]!.equals };
  return null;
}

/** Resume ABI: observe providers of identified context tokens (process-wide; null clears). */
export function _observeProvide(fn: (<T>(token: Context<T>, value: T) => void) | null): void { provideObserver = fn; }
