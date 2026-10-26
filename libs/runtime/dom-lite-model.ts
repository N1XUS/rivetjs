// Lite runtime: `model:value` / `model:checked` (RT-DIET; a leaf of `dom-lite.ts`, see `dom-lite-core.ts`).
import type { Signal } from "@rivetjs/reactivity";
import { effect, on } from "./dom-lite-core.ts";

/**
 * `model:value` (text input / textarea) / `model:checked` (checkbox) over a keyed signal: the signal follows the control's
 * `input` / `change` (not while composing), the control the signal. First run (= `dom-adopt-run.ts` `dirtyOf`): a control
 * the user changed before adoption (value / checked ≠ its default) keeps its state (its held events replay into the
 * signal); a pristine one takes the signal's value when it differs (the parser normalized it, e.g. NUL → U+FFFD),
 * keeping a focused selection.
 */
export function _lm(el: HTMLInputElement, kind: "value" | "checked", state: Signal<unknown>): void {
  let first = 1,
    composing = 0;
  const pull = (): unknown => composing || state.set(el[kind]);
  effect(() => {
    const v = state();
    if (first) {
      first = 0;
      if (el[kind] === v || (kind == "value" ? el.value !== el.defaultValue : el.checked !== el.defaultChecked)) return;
      const focused = kind == "value" && el.ownerDocument.activeElement === el,
        a = el.selectionStart,
        b = el.selectionEnd,
        d = el.selectionDirection;
      (el[kind] as unknown) = v;
      if (focused && a !== null) el.setSelectionRange(a, b, d!);
    } else composing || el[kind] === v || ((el[kind] as unknown) = v);
  });
  on(el, kind == "value" ? "input" : "change", pull);
  el.addEventListener("compositionstart", () => (composing = 1));
  el.addEventListener("compositionend", () => ((composing = 0), pull()));
}
