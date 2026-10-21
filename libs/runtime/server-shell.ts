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
import type { ShellHook, _Encoding as Encoding, _Recorder as Recorder } from "./server-resume.ts";

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
}

export interface ShellHookOptions {
  /** Fill: the root numbering (called before the first patch encodes; never when nothing streams). */
  seal?(seal: ShellSeal): void;
  /** Replay: the fill's numbering. The root tail writes and encodes nothing. */
  replay?: ShellSeal;
  /** The shell's content ends here: the root tail starts (fill) / would start (replay; nothing of it is written). */
  cut?(): void;
  /** Replay: the render cannot reproduce the fill's numbering (`why`); the patch encode then throws. */
  mismatch?(why: string): void;
}

/** A pending segment stand-in: the replay's late shell encode sees the segments the fill's tail saw (`j` entries off). */
const PENDING = { out: null } as unknown as NonNullable<Recorder["stream"]>["segments"][number];

const flags = (recorder: Recorder): number =>
  (recorder.rowsAddon ? 1 : 0) | (recorder.lazyAddon ? 2 : 0) | (recorder.expandAddon ? 4 : 0) | (recorder.repeatAddon ? 8 : 0);

const sealOf = (recorder: Recorder, enc: Encoding): ShellSeal => ({
  t: enc.encoder.table.length,
  c: enc.chunks.slice(),
  s: [...enc.symbols],
  e: [...enc.events],
  f: flags(recorder),
});

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
  return {
    tail(recorder, encode, encoding) {
      // Not covered (falls back to the default tail): no root state, the derived model, DOM-backed data, bridge lean tails.
      const covered = recorder.used && recorder.stream !== null && !recorder.derived && !recorder.dom && !recorder.lean;
      const replay = options.replay;
      if (!replay) {
        // The root encode itself (the default tail, right after this) passes through: sealed at the first patch.
        if (covered)
          recorder.thaw = (view) => {
            if (view === recorder) return;
            recorder.thaw = undefined;
            options.seal?.(sealOf(recorder, recorder.enc!));
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
      recorder.thaw = (view) => {
        recorder.thaw = undefined;
        if (quiet(view)) {
          const enc = encoding(recorder);
          enc.encoder.table.length = replay.t;
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
