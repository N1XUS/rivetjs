import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { watchInteractOutside } from "@rivetjs/cdk/interactions/interact-outside";

export const head = { title: "watchInteractOutside" };

// #region demo
export default function Panel() {
  const panel = ref<HTMLDivElement>();
  const count = signal(0);
  const starts = signal(0);
  const paused = signal(false);
  watchInteractOutside({
    ref: panel,
    isDisabled: paused,
    onInteractOutsideStart: () => starts.update((n) => n + 1),
    onInteractOutside: () => count.update((n) => n + 1),
  });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div id="panel" ref={panel} class="grid gap-2 rounded-md border border-teal-700 p-3">
        <p>The panel</p>
        <div class="flex gap-2">
          <button id="inside" type="button" class="rounded border border-slate-300 px-2 py-1">
            Inside
          </button>
          <button id="pause" type="button" class="rounded border border-slate-300 px-2 py-1" onClick={() => paused.update((v) => !v)}>
            {paused() ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
      <button id="outside" type="button" class="justify-self-start rounded border border-slate-300 px-2 py-1">
        Outside
      </button>
      <output id="count">
        Outside: {count()} (starts {starts()})
      </output>
    </section>
  );
}
// #endregion
