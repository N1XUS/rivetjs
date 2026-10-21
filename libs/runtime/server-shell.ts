// Shell cache hooks (router route rule `shell`, spec docs/design/specs/2026-10-20-ppr-shell-design.md §3.2, PPR-T3B): the
// `shell` render option of `renderResumable` (`server-resume.ts` `ShellHook`). Only the router's shell cache imports this
// module, so pages without a `shell` rule carry none of it (server-resume pays one optional call at the tail and one before
// each patch encode).
//
// Fill: `cut` runs where the root tail starts, the tail encodes as usual; before the first patch encodes, `seal` receives the root encode's numbering (table
// length, chunk list, page symbols, events, add-ons), which the shell entry stores beside the prefix bytes.
//
// Replay (a hit): the root tail writes nothing and encodes nothing (the stored prefix holds the fill's state script); `cut`
// runs where it would have started. Before the first patch encodes, the root numbering is thawed:
// - the segment recorded no capture (no element, text, region, list, effect, client event, preload, path, lazy For, event):
//   its patch can reference nothing of the shell, so the encoder is seeded with the fill's numbering (no shell walk at all);
// - else the shell's records are encoded now, exactly as the fill's tail did (same walk, same order: same table indexes,
//   chunk and symbol numbers), the output dropped; the result is checked against the seal (`mismatch`, then a throw).
//
// H-holes (PPR-T6): a fill of a page whose every streamed boundary is a top-level `Async` the compiler marked `$hole`
// (`moduleFacts` `holes`: its `load` / `children` capture data consts, deferred handles and module refs only, no signal
// made in its component) retains each boundary — props, a detached owner holding its context frame, its marker ids and
// region — plus the encoder's numbering at the seal (`fork`) and the render's next id / id counter at the cut. A hit then
// renders no shell at all: `shellHoles(retained)` is the page factory; it re-runs each boundary's `Async` under its frame
// (the id counter shadowed by the hit's) with the fill's numbering, its fallback rendered empty and discarded; the
// segments stream as in a fresh render and encode against a read-through overlay of the fill's table (`base`).
import { createRoot, getOwner, provide, runWithOwner, _detach, _inspect, _rootIn, type Context, type Owner } from "@rivetjs/reactivity";
import { Async, type AsyncProps } from "./server-async.ts";
import { _idScope, _inIdScope, type IdScope } from "./id.ts";
import { renderToString, type ServerValue } from "./server.ts";
import type { EncoderState } from "./resume-format.ts";
import { _shellRecorder, type ShellHook, type _Encoding as Encoding, type _Recorder as Recorder, type _Segment as Segment } from "./server-resume.ts";
import type { DerivedSeal } from "./server-derived.ts";

/** The root encode's numbering after a fill's tail: what the replay's patches encode against. */
export interface ShellSeal {
  /** Encoder table length. */
  readonly t: number;
  /** Chunk URLs (state `c`). */
  readonly c: readonly string[];
  /** Page symbols: [symbol id, wire index]. */
  readonly s: readonly (readonly [string, number])[];
  /** Event types the root state listens for. */
  readonly e: readonly string[];
  /** Add-ons the page shipped: 1 rows, 2 lazy, 4 expand, 8 repeat. */
  readonly f: number;
  /** H-holes: the encoder's numbering (table + interned values; in memory only, never serialized). */
  readonly fork?: EncoderFork;
  /** The derived model (DERIVED-C3): no state numbering (the tail is values only); muted replays flush it, H-holes run. */
  readonly d?: 1;
}

/**
 * H-holes: a sealed encoder's numbering (a copy, never written): table entries and interned values, and the provider
 * lists the shell's encode wrote (a hole's computed under the same providers reuses that table entry, as in the fill).
 */
export interface EncoderFork {
  readonly table: readonly EncoderState["table"][number][];
  readonly primitives: ReadonlyMap<unknown, number>;
  readonly specials: ReadonlyMap<string, number>;
  readonly objects: ReadonlyMap<object, number>;
  readonly providers: ReadonlyMap<unknown[], number | null>;
}
/** Read-through overlay of a fork's map: own writes, the base's entries visible (copy-on-write without the copy). */
class Overlay<K, V = number> extends Map<K, V> {
  declare base: ReadonlyMap<K, V>;
  constructor(base: ReadonlyMap<K, V>) {
    super();
    this.base = base;
  }
  override get(key: K): V | undefined {
    const own = super.get(key);
    return own === undefined ? this.base.get(key) : own;
  }
  override has(key: K): boolean {
    return super.has(key) || this.base.has(key);
  }
}
const forkOf = (enc: Encoding): EncoderFork => {
  const state = enc.encoder.state();
  return {
    table: state.table.slice(),
    primitives: new Map(state.primitives),
    specials: new Map(state.specials),
    objects: new Map(state.objects),
    providers: new Map(enc.providers),
  };
};
/** A hit's encoder start: the fork's table copied, its maps behind overlays. */
const opened = (fork: EncoderFork) => (): EncoderState => ({
  table: fork.table.slice(),
  primitives: new Overlay(fork.primitives),
  specials: new Overlay(fork.specials),
  objects: new Overlay(fork.objects),
});

/** H-holes: one retained boundary of a fill (`ShellHookOptions.holes`). */
export interface ShellHole {
  /** Marker ids: the boundary (`A`), its fallback region (`F`). */
  readonly A: number;
  readonly F: number;
  /** The region the boundary claimed (its id is read at the hit: assigned once the shell's site closed). */
  readonly M: Segment["M"];
  readonly props: AsyncProps<unknown>;
  /** A detached owner under the boundary's: its context frame. */
  readonly pin: Owner;
}
/** H-holes: what a fill retains for hits that run no shell (`ShellHookOptions.holes`). */
export interface ShellHoles {
  readonly holes: readonly ShellHole[];
  /** The recorder's next id where the shell ended. */
  readonly n: number;
  /** The render's id counter (`createId`) where the shell ended, and its prefix. */
  readonly ids: number;
  readonly prefix: string;
  /** Provided context values / identified tokens of the shell (the encoder's `{x}` references, region providers). */
  readonly contexts: ReadonlyMap<unknown, string>;
  readonly tokens: ReadonlyMap<string, unknown>;
  /**
   * Signals the retained frames reach through provided context values (an ancestor's state the holes share across hits),
   * with their values at the cut: a hole that writes one makes the entry replay-only (`shellWritten`, PPR-T57).
   */
  readonly watch: readonly (readonly [signal: () => unknown, value: unknown])[];
  /** Derived model (DERIVED-C3): the fill's hole keys and content numbering. */
  readonly derived?: DerivedSeal;
  /** Derived model: why the fill's holes (once ended) made hits unable to serve them alone (`shellWritten`), else null. */
  readonly check?: () => string | null;
}
/** A context value of the retained frames swapped per hit (`shellHoles`): the fill's value in, the hit's out. */
export type ShellSwap = readonly [token: Context<unknown>, swap: (fill: unknown) => unknown];

export interface ShellHookOptions {
  /** Fill: the root numbering (called before the first patch encodes; never when nothing streams). */
  seal?(seal: ShellSeal): void;
  /** Replay: the fill's numbering. The root tail writes and encodes nothing. */
  replay?: ShellSeal;
  /** The shell's content ends here: the root tail starts (fill) / would start (replay; nothing of it is written). `derived`: the
   * tail is the derived model's (boundaries script + loader, DERIVED-C3). */
  cut?(derived?: boolean): void;
  /** Replay: the render cannot reproduce the fill's numbering (`why`); the patch encode then throws. */
  mismatch?(why: string): void;
  /**
   * Fill: at the cut, the retained boundaries when every streamed boundary of the shell is retainable (top-level `Async`
   * marked `$hole`, outside an `ErrorBoundary`); else `why` (the entry then replays: H-replay).
   */
  holes?(holes: ShellHoles | null, why: string | null): void;
  /** Replay with no shell render (`shellHoles` is the page factory): the fill's retained boundaries. */
  retained?: ShellHoles;
  /** H-holes hit: the request's deferred loader promises per data slot (`shellSlots`). */
  slots?: readonly (PromiseLike<unknown> | undefined)[];
}

/** A pending segment stand-in: the replay's late shell encode sees the segments the fill's tail saw (`j` entries off). */
const PENDING = { out: null } as unknown as NonNullable<Recorder["stream"]>["segments"][number];

const flags = (recorder: Recorder): number =>
  (recorder.rowsAddon ? 1 : 0) | (recorder.lazyAddon ? 2 : 0) | (recorder.expandAddon ? 4 : 0) | (recorder.repeatAddon ? 8 : 0);

const sealOf = (recorder: Recorder, enc: Encoding, fork?: boolean): ShellSeal => ({
  t: enc.encoder.table.length,
  c: enc.chunks.slice(),
  s: [...enc.symbols],
  e: [...enc.events],
  f: flags(recorder),
  ...(fork ? { fork: forkOf(enc) } : {}),
});
/** The chunk / symbol / event numbering of a seal, seeded into a replay's encoding. */
const seed = (enc: Encoding, replay: ShellSeal): void => {
  enc.encoder.table.length = replay.t;
  for (let i = 0; i < replay.c.length; i++) enc.chunkOf.set(replay.c[i]!, enc.chunks.push(replay.c[i]!) - 1);
  for (const [symbol, index] of replay.s) enc.symbols.set(symbol, index);
  for (const type of replay.e) enc.events.add(type);
};
const NO_FALLBACK = (): null => null;

/** Reactivity's context chain of an owner (`ctx`: immutable frames, the nearest provider first). */
interface Frame {
  readonly token: Context<unknown>;
  readonly value: unknown;
  readonly up: Frame | null;
}
const frameOf = (owner: Owner): Frame | null => (owner as unknown as { ctx: Frame | null }).ctx;
/** Context values are walked this deep (plain data: objects, arrays) and this wide per fill. */
const DEPTH = 4,
  WIDE = 1024;
/**
 * The signals the retained frames reach through provided context values (stores included: a store's root is a signal),
 * with their values now. Data properties only (no getter runs); computeds are skipped (derived: their sources count).
 */
export type _FrameSignals = typeof frameSignals;
function frameSignals(holes: readonly ShellHole[], source?: (fn: object) => (() => unknown) | undefined): [() => unknown, unknown][] {
  const out: [() => unknown, unknown][] = [];
  const frames = new Set<Frame>(),
    seen = new Set<unknown>();
  const scan = (value: unknown, depth: number): void => {
    if (typeof value === "function") {
      // A derived keyed signal is a getter around its signal (`_rSig`): the signal is watched.
      value = source?.(value) ?? value;
      const info = _inspect(value);
      if (info?.kind === "signal" && !seen.has(value)) (seen.add(value), out.push([value as () => unknown, info.value]));
      return;
    }
    if (value === null || typeof value !== "object" || depth > DEPTH || seen.size >= WIDE || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) scan(item, depth + 1);
      return;
    }
    for (const key of Object.keys(value)) {
      const desc = Object.getOwnPropertyDescriptor(value, key);
      if (desc && "value" in desc) scan(desc.value, depth + 1);
    }
  };
  for (const hole of holes)
    for (let frame = frameOf(hole.pin); frame !== null && !frames.has(frame); frame = frame.up) {
      frames.add(frame);
      scan(frame.value, 0);
    }
  return out;
}
/**
 * H-holes (PPR-T57): why the retained frames are no longer what the fill's shell left (a hole wrote a signal an enclosing
 * provider shares: later hits would read that write), or null. The shell cache asks at the fill's end and after each hit;
 * a reason makes the entry replay-only.
 */
export function shellWritten(retained: ShellHoles): string | null {
  const why = retained.check?.();
  if (why) return why;
  for (const [signal, value] of retained.watch)
    if (!Object.is((_inspect(signal) as { value: unknown }).value, value))
      return "a hole wrote a signal an enclosing component provides through context (shared by every hit's holes)";
  return null;
}
/** The fill's holes must end before hits may serve them alone (a frame watch or a derived check). */
export const shellWatching = (retained: ShellHoles): boolean => retained.watch.length > 0 || retained.check !== undefined;
/** Inside a boundary's content (`ErrorBoundary`): a failing hole would route to the fill's boundary. */
const caught = (scope: Segment["M"] | null): boolean => {
  for (; scope; scope = scope.parent) if (scope.boundary) return true;
  return false;
};

/** Nothing a patch encode would reference the table, chunks or symbols for. */
const quiet = (view: Recorder): boolean =>
  view.elements.length === 0 &&
  view.texts.length === 0 &&
  view.regions.length === 0 &&
  view.lists.length === 0 &&
  view.effects.length === 0 &&
  view.clientEvents.length === 0 &&
  view.preloads.length === 0 &&
  view.paths.length === 0 &&
  view.lazy.length === 0 &&
  view.events.size === 0;

/** The `shell` option of `renderResumable` for a fill (`seal`) or a replay (`replay` + `cut`). */
export function shellHook(options: ShellHookOptions): ShellHook {
  // Fill with `holes`: the retainable boundaries so far; `refused`: the first reason one is not.
  let kept: ShellHole[] | null = null,
    refused: string | null = null;
  return {
    ...(options.slots ? { slots: options.slots } : {}),
    ...(options.holes
      ? {
          hole(segment: Segment, props: object, owner: Owner | null | undefined): void {
            if (segment.parent !== null) return; // inside a hole: re-created with its content on a hit
            const list = (kept ??= []);
            if ((props as { $hole?: unknown }).$hole !== 1) return void (refused ??= "a streamed `Async` the compiler did not mark `$hole`");
            if (caught(segment.M)) return void (refused ??= "a streamed `Async` inside an `ErrorBoundary`");
            if (!owner) return void (refused ??= "a streamed `Async` without an owner");
            const pin = runWithOwner(owner as never, () => createRoot(getOwner).value)!;
            _detach(pin);
            list.push({ A: segment.A, F: segment.F, M: segment.M, props: props as AsyncProps<unknown>, pin: pin as unknown as Owner });
          },
        }
      : {}),
    tail(recorder, encode, encoding) {
      const derived = recorder.derived;
      // The derived model's shell tail lives with its recorder (`server-derived.ts`: derived builds only carry it).
      if (derived) return derived.shell.tail(derived, options, recorder, kept, refused, () => ((kept = null), (refused = null)), frameSignals);
      // Not covered (falls back to the default tail): no root state, DOM-backed data, bridge lean tails (the derived model: above).
      const covered = recorder.used && recorder.stream !== null && !recorder.dom && !recorder.lean;
      const replay = options.replay;
      if (!replay) {
        let retain = false;
        if (options.holes) {
          const why = !covered
            ? "no streamed resumable state of the serialized model"
            : (refused ?? ((kept ??= []).length === 0 ? "no streamed boundary" : null));
          const segments = recorder.stream?.segments ?? [];
          const reason = why ?? (segments.length !== kept!.length ? "a streamed boundary is not a top-level `Async` the compiler marked `$hole`" : null);
          if (reason !== null) options.holes(null, reason);
          else {
            const scope = runWithOwner(kept![0]!.pin, _idScope);
            if (!scope) options.holes(null, "no id scope");
            else {
              retain = true;
              options.holes(
                {
                  holes: kept!,
                  n: recorder.next,
                  ids: scope.n,
                  prefix: scope.prefix,
                  contexts: new Map(recorder.contexts),
                  tokens: new Map(recorder.tokens),
                  watch: frameSignals(kept!),
                },
                null,
              );
            }
          }
          kept = null;
        }
        // The root encode itself (the default tail, right after this) passes through: sealed at the first patch.
        if (covered)
          recorder.thaw = (view) => {
            if (view === recorder) return;
            recorder.thaw = undefined;
            options.seal?.(sealOf(recorder, recorder.enc!, retain));
          };
        options.cut?.();
        return false;
      }
      if (!covered) {
        options.mismatch?.("the replay's page has no streamed resumable state of the serialized model");
        options.cut?.();
        return false;
      }
      recorder.rowsAddon = (replay.f & 1) !== 0;
      recorder.lazyAddon = (replay.f & 2) !== 0;
      recorder.expandAddon = (replay.f & 4) !== 0;
      recorder.repeatAddon = (replay.f & 8) !== 0;
      const retained = options.retained;
      if (retained) {
        // H-holes: no shell rendered; the boundaries re-ran with the fill's ids (checked here), the rest continues after them.
        const segments = recorder.stream!.segments;
        const holes = retained.holes;
        let at = 0;
        for (const segment of segments) {
          if (segment.parent !== null) continue;
          const hole = holes[at++];
          if (!hole || segment.A !== hole.A || segment.F !== hole.F) {
            options.mismatch?.("the hit's boundaries number differently from the stored shell's");
            break;
          }
        }
        if (at !== holes.length) options.mismatch?.("the hit opened " + at + " boundaries, the stored shell " + holes.length);
        recorder.next = retained.n;
      }
      recorder.thaw = (view) => {
        recorder.thaw = undefined;
        if (quiet(view)) return seed(encoding(recorder), replay);
        if (retained) {
          // The holes' records reference the shell's values: encode against the fill's numbering (read-through overlay).
          if (!replay.fork) {
            const why = "the stored shell has no encoder numbering";
            options.mismatch?.(why);
            throw new Error("Shell mismatch: " + why);
          }
          recorder.base = opened(replay.fork);
          const enc = encoding(recorder);
          enc.providers = new Overlay(replay.fork.providers) as Map<unknown[], number | null>;
          for (let i = 0; i < replay.c.length; i++) enc.chunkOf.set(replay.c[i]!, enc.chunks.push(replay.c[i]!) - 1);
          for (const [symbol, index] of replay.s) enc.symbols.set(symbol, index);
          for (const type of replay.e) enc.events.add(type);
          return;
        }
        const segments = recorder.stream!.segments;
        segments.push(PENDING);
        try {
          encode(recorder, recorder);
        } finally {
          segments.pop();
        }
        const now = sealOf(recorder, recorder.enc!);
        if (now.t !== replay.t || now.c.join(" ") !== replay.c.join(" ") || now.s.join() !== replay.s.join() || now.e.join() !== replay.e.join()) {
          const why = `the replay's state numbering differs from the stored shell's (table ${now.t} vs ${replay.t})`;
          options.mismatch?.(why);
          throw new Error("Shell mismatch: " + why);
        }
      };
      options.cut?.();
      return true;
    },
  };
}

/**
 * H-holes: the running render's per-slot deferred loader promises (`ShellHookOptions.slots`), when it is a hit: a fill's
 * deferred handle (retained in a boundary's captures) follows the hit's slot instead of its own fill's (frame swap).
 */
export function shellSlots(): readonly (PromiseLike<unknown> | undefined)[] | undefined {
  return (_shellRecorder()?.options.shell as { slots?: readonly (PromiseLike<unknown> | undefined)[] } | undefined)?.slots;
}

/** The nearest provided value of `token` in an owner's frame (`MISSING`: none). */
const MISSING = {};
const providedIn = (owner: Owner, token: Context<unknown>): unknown => {
  for (let frame = frameOf(owner); frame !== null; frame = frame.up) if (frame.token === token) return frame.value;
  return MISSING;
};

/**
 * H-holes: the page factory of a hit (`renderResumable` with `shell: shellHook({ replay, retained })`): no shell — each
 * retained boundary's `Async` runs again under its context frame (fresh root; the id counter is the hit's, continued from
 * the fill's), with the fill's marker ids and region; its fallback renders empty and is discarded. Nothing is written:
 * the segments stream after the (muted) root tail as in a fresh render. `swaps` (read per hit): context values of the
 * frame that belong to the request (the router's head sink), provided again with the hit's value around the boundary.
 */
export function shellHoles(retained: ShellHoles, swaps?: () => readonly ShellSwap[]): () => ServerValue {
  return () => {
    const recorder = _shellRecorder();
    if (!recorder?.stream) throw new Error("Shell holes need a streaming resumable render");
    const derived = recorder.derived,
      seal = retained.derived;
    if (derived && !seal) throw new Error("Shell holes of the serialized model in a derived render");
    // Derived: the content's boundaries number on from the fill's shell, its row / branch markers from the fill's count.
    if (derived) (derived.shell.begin(derived, seal!), (recorder.next = retained.n));
    else recorder.used = true;
    for (const [value, token] of retained.contexts) recorder.contexts.set(value, token);
    for (const [id, token] of retained.tokens) recorder.tokens.set(id, token as never);
    const ids: IdScope = _idScope() ?? { prefix: retained.prefix, n: 0 };
    ids.n = retained.ids;
    const { signal, variant } = recorder.options;
    const holder: { owner: never } = { owner: null as never };
    const swapped = swaps?.();
    for (let i = 0; i < retained.holes.length; i++) {
      const hole = retained.holes[i]!;
      const M = hole.M;
      // The claimed region as the boundary found it (unclaimed, no id yet); its fill id once claimed. Derived: no regions —
      // the hole runs under this render's derived recorder with the fill's key and place.
      const region = derived ? null : ({ ...M, async: false, id: null } as Segment["M"]);
      if (region) {
        recorder.region = region;
        recorder.next = hole.A;
      }
      const props = { ...hole.props, fallback: NO_FALLBACK };
      let run = derived
        ? (): ServerValue => derived.shell.hole(derived, seal!, i, () => _inIdScope(ids, () => Async(props)))
        : (): ServerValue => _inIdScope(ids, () => Async(props));
      if (swapped)
        for (const [token, swap] of swapped) {
          const fill = providedIn(hole.pin, token);
          if (fill === MISSING) continue;
          const value = swap(fill);
          if (value === fill) continue;
          // A captured value the encoder writes as a `{x}` reference stays one (the hit's value, the fill's name).
          const name = retained.contexts.get(fill);
          if (name !== undefined) recorder.contexts.set(value, name);
          const inner = run;
          run = () => provide(token, value, inner);
        }
      const value = _rootIn(
        hole.pin as never,
        (h) => {
          _detach(h.owner);
          return run();
        },
        holder,
      );
      if (region) region.id = M.id;
      void renderToString(value, { ...(signal ? { signal } : {}), ...(variant ? { variant } : {}) });
      recorder.region = null;
    }
    return null;
  };
}
