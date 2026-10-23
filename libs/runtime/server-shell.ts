// Shell cache hooks (router route rule `shell`, spec docs/design/specs/2026-10-20-ppr-shell-design.md §3.2, PPR-T3B; derived
// model DERIVED-C3): the `shell` render option of `renderResumable` (`server-derived.ts` `ShellHook`). Only the router's
// shell cache imports this module, so pages without a `shell` rule carry none of it (the renderer pays one optional call
// at the tail).
//
// Fill: `cut` runs where the root tail starts; the tail (boundaries script + loader: values only, no numbering to seal)
// writes as usual. Replay (a hit): the shell renders again, its tail is flushed (records count as written) but not written;
// `cut` runs where it would have started.
//
// H-holes (PPR-T6): a fill of a page whose every streamed boundary is a top-level `Async` the compiler marked `$hole`
// (`moduleFacts` `holes`: its `load` / `children` capture data consts, deferred handles and module refs only, no signal
// made in its component) retains each boundary — props and a detached owner holding its context frame — plus the derived
// recorder's hole keys / numbering and the render's marker count / id counter at the cut. A hit then renders no shell at
// all: `shellHoles(retained)` is the page factory; it re-runs each boundary's `Async` under its frame (the id counter
// shadowed by the hit's) with the fill's keys, its fallback rendered empty and discarded; the segments stream as in a
// fresh render.
import { createRoot, getOwner, provide, runWithOwner, _detach, _inspect, _rootIn, type Context, type Owner } from "@rivetjs/reactivity";
import { Async, type AsyncProps } from "./server-async.ts";
import { _idScope, _inIdScope, type IdScope } from "./id.ts";
import { renderToString, type ServerValue } from "./server.ts";
import { _shellRecorder, type ShellHook } from "./server-derived.ts";
import type { DerivedSeal } from "./server-derived.ts";

/** A fill's seal (the derived tail is values only: nothing to number); a replay hands it back. */
export interface ShellSeal {
  readonly d: 1;
}

/** H-holes: one retained boundary of a fill (`ShellHookOptions.holes`). */
export interface ShellHole {
  readonly props: AsyncProps<unknown>;
  /** A detached owner under the boundary's: its context frame. */
  readonly pin: Owner;
}
/** H-holes: what a fill retains for hits that run no shell (`ShellHookOptions.holes`). */
export interface ShellHoles {
  readonly holes: readonly ShellHole[];
  /** The render's next row / branch marker id where the shell ended. */
  readonly n: number;
  /** The render's id counter (`createId`) where the shell ended, and its prefix. */
  readonly ids: number;
  readonly prefix: string;
  /**
   * Signals the retained frames reach through provided context values (an ancestor's state the holes share across hits),
   * with their values at the cut: a hole that writes one makes the entry replay-only (`shellWritten`, PPR-T57).
   */
  readonly watch: readonly (readonly [signal: () => unknown, value: unknown])[];
  /** The fill's hole keys and content numbering (DERIVED-C3). */
  readonly derived: DerivedSeal;
  /** Why the fill's holes (once ended) made hits unable to serve them alone (`shellWritten`), else null. */
  readonly check: () => string | null;
}
/** A context value of the retained frames swapped per hit (`shellHoles`): the fill's value in, the hit's out. */
export type ShellSwap = readonly [token: Context<unknown>, swap: (fill: unknown) => unknown];

export interface ShellHookOptions {
  /** Fill: the seal (at the cut; only when the page streams). */
  seal?(seal: ShellSeal): void;
  /** Replay: the fill's seal. The root tail writes nothing. */
  replay?: ShellSeal;
  /** The shell's content ends here: the root tail starts (fill) / would start (replay; nothing of it is written). */
  cut?(): void;
  /** Replay: the render cannot reproduce the fill's boundaries (`why`). */
  mismatch?(why: string): void;
  /**
   * Fill: at the cut, the retained boundaries when every streamed boundary of the shell is retainable (top-level `Async`
   * marked `$hole`); else `why` (the entry then replays: H-replay).
   */
  holes?(holes: ShellHoles | null, why: string | null): void;
  /** Replay with no shell render (`shellHoles` is the page factory): the fill's retained boundaries. */
  retained?: ShellHoles;
  /** H-holes hit: the request's deferred loader promises per data slot (`shellSlots`). */
  slots?: readonly (PromiseLike<unknown> | undefined)[];
}

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
  const why = retained.check();
  if (why) return why;
  for (const [signal, value] of retained.watch)
    if (!Object.is((_inspect(signal) as { value: unknown }).value, value))
      return "a hole wrote a signal an enclosing component provides through context (shared by every hit's holes)";
  return null;
}
/** The fill's holes must end before hits may serve them alone (a frame watch or a derived check). */
export const shellWatching = (_retained: ShellHoles): boolean => true;
/** The `shell` option of `renderResumable` for a fill (`seal`) or a replay (`replay` + `cut`). */
export function shellHook(options: ShellHookOptions): ShellHook {
  // Fill with `holes`: the retainable boundaries so far; `refused`: the first reason one is not.
  let kept: ShellHole[] | null = null,
    refused: string | null = null;
  return {
    ...(options.slots ? { slots: options.slots } : {}),
    ...(options.holes
      ? {
          hole(props: object, owner: Owner | null | undefined): void {
            const list = (kept ??= []);
            if ((props as { $hole?: unknown }).$hole !== 1) return void (refused ??= "a streamed `Async` the compiler did not mark `$hole`");
            if (!owner) return void (refused ??= "a streamed `Async` without an owner");
            const pin = runWithOwner(owner as never, () => createRoot(getOwner).value)!;
            _detach(pin);
            list.push({ props: props as AsyncProps<unknown>, pin: pin as unknown as Owner });
          },
        }
      : {}),
    tail(recorder) {
      const derived = recorder.derived;
      return derived.shell.tail(derived, options, recorder, kept, refused, () => ((kept = null), (refused = null)), frameSignals);
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
    if (!recorder?.derived.stream) throw new Error("Shell holes need a streaming resumable render");
    const derived = recorder.derived,
      seal = retained.derived;
    // The content's boundaries number on from the fill's shell, its row / branch markers from the fill's count.
    derived.shell.begin(derived, seal);
    recorder.next = retained.n;
    const ids: IdScope = _idScope() ?? { prefix: retained.prefix, n: 0 };
    ids.n = retained.ids;
    const { signal, variant } = recorder.options;
    const holder: { owner: never } = { owner: null as never };
    const swapped = swaps?.();
    for (let i = 0; i < retained.holes.length; i++) {
      const hole = retained.holes[i]!;
      const props = { ...hole.props, fallback: NO_FALLBACK };
      // The hole runs under this render's derived recorder with the fill's key and place.
      let run = (): ServerValue => derived.shell.hole(derived, seal, i, () => _inIdScope(ids, () => Async(props)));
      if (swapped)
        for (const [token, swap] of swapped) {
          const fill = providedIn(hole.pin, token);
          if (fill === MISSING) continue;
          const value = swap(fill);
          if (value === fill) continue;
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
      void renderToString(value, { ...(signal ? { signal } : {}), ...(variant ? { variant } : {}) });
    }
    return null;
  };
}
