// The island root element (`<rivet-island data-ri style="display:contents">`) and its hydration effect. Compiled for
// both targets in resume mode (rivet.source): the effect is a resume symbol whose captures are the loader (`_rFn` /
// `_rMod` of the facade), the root ref, the framework props (forwarding getters stay live) and the policy options.
// Plain functions, not components: their parameters are values, so the root's attributes and content are static
// markup (no resume sites); only the hydrated variant records anything (the ref's `data-r` and one effect).
import { getOwner, runWithOwner } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import type { ClientWhen } from "@rivetjs/runtime/dom";
import type { IslandModule, PolicyOptions } from "./adapter.ts";

/** @internal A static island: framework HTML + Rivet slot content, nothing recorded. */
export function _staticRoot(id: string, rf: string | undefined, rc: string | undefined, parts: unknown): unknown {
  return (
    <rivet-island data-ri={id} data-rf={rf} data-rc={rc} style={{ display: "contents" }}>
      {parts as never}
    </rivet-island>
  );
}

/** @internal An island the browser hydrates (`when`), or tracks for hydrate-on-change (no `options.on`). */
export function _hydratedRoot(
  id: string,
  rf: string | undefined,
  rc: string | undefined,
  parts: unknown,
  load: () => Promise<IslandModule>,
  props: Record<string, unknown>,
  options: PolicyOptions,
  when: ClientWhen,
): unknown {
  const root = ref<HTMLElement>();
  clientEffect(
    () => {
      // The driver runs with this effect's owner: the island unmounts when the region holding it is disposed.
      const owner = getOwner();
      let live = true;
      // An intent island needs the on-demand intent module too: fetched next to the driver, not after it.
      if (options.on === "intent") void import("@rivetjs/bridge/intent");
      void import("@rivetjs/bridge/client").then((driver) => live && runWithOwner(owner, () => driver.hydrateIsland(load, root()!, props, options)));
      return () => (live = false);
    },
    { when },
  );
  return (
    <rivet-island data-ri={id} data-rf={rf} data-rc={rc} style={{ display: "contents" }} ref={root}>
      {parts as never}
    </rivet-island>
  );
}
