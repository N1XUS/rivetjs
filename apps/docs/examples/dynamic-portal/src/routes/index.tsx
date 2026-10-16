import { signal } from "@rivetjs/reactivity";
import { Dynamic, Portal, Show } from "@rivetjs/runtime/dom";

export const head = { title: "Dynamic and Portal" };

// #region demo
export default function Page() {
  const level = signal<"h2" | "h3">("h2");
  const open = signal(false);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      {/* Dynamic reads `component` once: `keyed` re-creates it when the tag changes. */}
      <Show when={level()} keyed>
        {(tag) => (
          <Dynamic component={tag()} id="heading" class="font-semibold">
            Level {tag() === "h2" ? "2" : "3"} heading
          </Dynamic>
        )}
      </Show>
      <div class="flex gap-2">
        <button id="level" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={() => level.update((t) => (t === "h2" ? "h3" : "h2"))}>
          Switch level
        </button>
        <button id="open" type="button" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={() => open.set(true)}>
          Save
        </button>
      </div>
      {/* Portal content is created in the browser only: render it behind a signal. */}
      <Show when={open()}>
        {() => (
          <Portal>
            <div id="notice" role="status" class="fixed bottom-4 left-4 flex items-center gap-3 rounded-md bg-slate-900 px-3 py-2 text-white">
              Saved
              <button id="close" type="button" class="underline" onClick={() => open.set(false)}>
                Dismiss
              </button>
            </div>
          </Portal>
        )}
      </Show>
    </div>
  );
}
// #endregion
