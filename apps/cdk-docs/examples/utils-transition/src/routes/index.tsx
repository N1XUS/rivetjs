import { signal } from "@rivetjs/reactivity";
import { runAfterTransition } from "@rivetjs/cdk/utils";

export const head = { title: "runAfterTransition()" };

// #region demo
export default function AfterTransition() {
  const open = signal(false);
  const log = signal<string[]>([]);
  const add = (line: string) => log.update((lines) => [...lines, line]);
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <div class="flex gap-2">
        <button id="slide" type="button" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={() => open.update((o) => !o)}>
          Slide (300 ms)
        </button>
        <button
          id="now"
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1"
          onClick={() => runAfterTransition((isTransition) => add(isTransition ? "after the transition" : "no transition"))}
        >
          Run now
        </button>
      </div>
      <div class="h-6 overflow-hidden rounded bg-slate-100">
        {/* Runs once every running CSS transition in the document ended (or next frame if none). Asked when the width
            transition has started: the browser starts it at a later style recalc than the click's frame callbacks. */}
        <div
          id="bar"
          class="h-6 bg-teal-600 transition-[width] duration-300"
          style={{ width: open() ? "100%" : "10%" }}
          onTransitionRun={() => runAfterTransition((isTransition) => add(isTransition ? "after the transition" : "no transition"))}
        />
      </div>
      <ol id="log" class="list-decimal ps-6">
        {log().map((line) => (
          <li>{line}</li>
        ))}
      </ol>
    </section>
  );
}
// #endregion
