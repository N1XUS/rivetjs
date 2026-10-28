// Lite runtime: a conditional native subtree (`{test() ? <el …/> : null}`, JS-DIET-2 2026-10-28; a leaf of `dom-lite.ts`,
// see `dom-lite-core.ts`).
import { type Eff, _lw, effect, miss, onRelease, own, release, untracked } from "./dom-lite-core.ts";
import { build, type LiteSpec } from "./dom-lite-spec.ts";

/**
 * `at` = the slot's content opener (server `<!--[-->` + the branch element when the test held, + `<!--]-->`). The first
 * run binds the server element through `branch(el)` (or builds it from `spec` / removes it when the test disagrees);
 * later runs build the branch from `spec` and bind it, or remove it and release what it bound. Anything else between the
 * markers (a Text, two nodes): `LiteMiss`.
 */
export function _lo(at: Node, test: () => unknown, branch: (n: Element) => void, spec: LiteSpec): void {
  const end = _lw(at, "h");
  let el = at.nextSibling == end ? null : (at.nextSibling as Element),
    mine: Eff[] = [],
    bound = 0;
  if (el && (el.nodeType != 1 || el.nextSibling != end)) miss("branch");
  onRelease(() => release(mine));
  effect(() => {
    const on = !!test();
    if (bound && on == !!el) return;
    bound = 1;
    untracked(() => {
      if (on) {
        el ||= end.parentNode!.insertBefore(build(at.ownerDocument!, spec) as Element, end);
        own((mine = []), () => branch(el!));
      } else if (el) {
        el.remove();
        release(mine);
        el = null;
      }
    });
  });
}
