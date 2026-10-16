import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { FocusScope } from "@rivetjs/cdk/focus-scope";

export const head = { title: "FocusScope restoreFocus and autoFocus" };

// #region demo
export default function Rename() {
  const open = signal(false);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <button id="open" type="button" class="justify-self-start rounded-md border border-slate-300 px-3 py-1" onClick={() => open.set(true)}>
        Rename…
      </button>
      <Show when={open}>
        {() => (
          // autoFocus: first field on mount; restoreFocus: back to "Rename…" on unmount.
          <FocusScope contain restoreFocus autoFocus class="grid gap-2 rounded-md border border-teal-700 p-3">
            <label class="grid gap-1">
              New name <input id="panel-name" class="rounded border border-slate-300 px-2 py-1" />
            </label>
            <button
              id="panel-done"
              type="button"
              class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
              onClick={() => open.set(false)}
            >
              Done
            </button>
          </FocusScope>
        )}
      </Show>
    </section>
  );
}
// #endregion
