import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Portal } from "@rivetjs/cdk/portal";

export const head = { title: "Portal" };

// #region demo
export default function Notices() {
  const open = signal(false);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      {/* A clipped, scrolling card: content rendered inside it could not overflow it. */}
      <div id="card" class="h-16 overflow-hidden rounded-md border border-slate-300 p-3">
        <button
          id="show"
          type="button"
          class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          aria-expanded={open() ? "true" : "false"}
          aria-controls="notice"
          onClick={() => open.set(true)}
        >
          Show a notice
        </button>
      </div>
      {/* Behind a signal: created in the browser the first time `open` turns true, removed when it turns false. */}
      <Show when={open}>
        {() => (
          <Portal>
            <div id="notice" role="status" class="fixed right-4 bottom-4 flex items-center gap-3 rounded-md bg-slate-900 px-4 py-2 text-white">
              Rendered at the end of body.
              <button id="dismiss" type="button" class="underline" onClick={() => open.set(false)}>
                Dismiss
              </button>
            </div>
          </Portal>
        )}
      </Show>
    </section>
  );
}
// #endregion
