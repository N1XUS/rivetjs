// @rivetjs/bridge-preact/server — Preact server adapter (spec §3.3): preact-render-to-string `renderToString` (sync,
// the fast path); a tree that suspends (`lazy`, a thrown promise, `Suspense` from `preact/compat`) makes it throw
// "Use renderToStringAsync…" (a pending `lazy` throws its promise), and the island renders again through
// `renderToStringAsync`. `useId` is masked by the
// island id (`tree.ts`); the first render probes that Preact still reads the mask (RV2150 otherwise). Preact has no
// hoistables: no island head (a `<title>` renders inline in the island). A render error rejects (the bridge's error path).
import { renderToString, renderToStringAsync } from "preact-render-to-string";
import { h, type ComponentType } from "preact";
import { useId } from "preact/hooks";
import type { ServerAdapter, SlotMark } from "@rivetjs/bridge/adapter";
import { islandElement, maskOf } from "./tree.ts";
import { withSlots } from "./slot.ts";

/**
 * preact-render-to-string's error for a suspension the sync renderer cannot wait for. Keyed on its message text (no
 * code): an upgrade that rewords it fails `tests/ssr.test.ts` ("suspension message") loudly.
 */
const SUSPENDED = /renderToStringAsync/;

const Probe = () => h("i", null, useId());
let probed: Error | null | undefined;
/**
 * RV2150: `tree.ts` sets Preact's private `useId` mask field. A Preact version that moved it would give every island the
 * same ids (`P0-0`, …) without any mismatch; checked once per process, then every Preact island fails loudly.
 */
function probe(): void {
  if (probed === undefined) {
    const html = renderToString(islandElement(Probe, {}, maskOf("rv")));
    probed =
      html === "<i>Prv-0</i>"
        ? null
        : new Error(
            `[RV2150] Preact useId mask not applied (probe rendered ${html}): Preact island ids would not be unique. This Preact version is not supported by @rivetjs/bridge-preact; update it or pin preact to a supported version.`,
          );
  }
  if (probed) throw probed;
}

/** The Preact server adapter (`IslandDef.a` of Preact islands). */
export const adapter: ServerAdapter<ComponentType<Record<string, unknown>>> = {
  name: "preact",
  render(component, props, slots: Record<string, SlotMark>, ctx) {
    probe();
    const element = () => islandElement(component, withSlots(props, Object.keys(slots)), maskOf(ctx.id));
    try {
      return renderToString(element());
    } catch (error) {
      // `lazy` (preact/compat) throws its pending promise itself rather than the message.
      if (typeof (error as PromiseLike<unknown> | null)?.then === "function" || SUSPENDED.test(String((error as Error | null)?.message)))
        return renderToStringAsync(element());
      throw error;
    }
  },
};
