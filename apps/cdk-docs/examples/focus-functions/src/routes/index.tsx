import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { containFocus, focusFirst, focusLast, inertOutside, saveFocus } from "@rivetjs/cdk/focus";

export const head = { title: "Focus functions" };

const btn = "rounded border border-slate-300 px-2 py-1";

// #region demo
// Browser-only state of the demo (functions are not serialized): module scope, set in handlers.
const pending: { restore?: () => void; release?: () => void } = {};

export default function FocusFunctions() {
  const box = ref<HTMLDivElement>();
  const isolated = signal(false);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div id="outside" class="flex flex-wrap gap-2">
        <button id="first" type="button" class={btn} onClick={() => focusFirst(box()!)}>
          focusFirst
        </button>
        <button id="last" type="button" class={btn} onClick={() => focusLast(box()!)}>
          focusLast
        </button>
        <button
          id="remember"
          type="button"
          class={btn}
          onClick={() => {
            pending.restore = saveFocus();
            focusFirst(box()!);
          }}
        >
          saveFocus, then go in
        </button>
        <button
          id="isolate"
          type="button"
          class={btn}
          onClick={() => {
            pending.release = inertOutside(box()!);
            isolated.set(true);
            focusFirst(box()!);
          }}
        >
          inertOutside
        </button>
      </div>
      <div
        id="box"
        ref={box}
        class="flex gap-2 rounded-md border border-teal-700 p-3"
        onKeyDown={(e) => {
          containFocus(e.currentTarget, e);
          if (e.key === "Escape") pending.restore?.();
        }}
      >
        <button id="a" type="button" class={btn}>
          A
        </button>
        <input id="b" aria-label="B" class="w-16 rounded border border-slate-300 px-2 py-1" />
        <button id="c" type="button" class={btn}>
          C
        </button>
        <button
          id="release"
          type="button"
          class={btn}
          hidden={!isolated()}
          onClick={() => {
            pending.release?.();
            isolated.set(false);
          }}
        >
          Release
        </button>
      </div>
      <p>Escape inside the box restores the focus saved by "saveFocus".</p>
    </section>
  );
}
// #endregion
