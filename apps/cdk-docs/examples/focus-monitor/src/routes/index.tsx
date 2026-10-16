import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { getFocusMonitor } from "@rivetjs/cdk/a11y/focus-monitor";

export const head = { title: "FocusMonitor" };

// #region demo
export default function Monitored() {
  const field = ref<HTMLInputElement>();
  const group = ref<HTMLDivElement>();
  const origin = signal("none");
  clientEffect(() => {
    const input = field(),
      box = group();
    if (!input || !box) return;
    const monitor = getFocusMonitor();
    const subscription = monitor.monitor(input).subscribe((how) => origin.set(how ?? "blurred"));
    // checkChildren: classes on the group while anything inside has focus.
    monitor.monitor(box, true);
    return () => {
      subscription.unsubscribe();
      monitor.stopMonitoring(input);
      monitor.stopMonitoring(box);
    };
  });
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <div class="flex gap-2">
        <button id="program" type="button" class="rounded border border-slate-300 px-2 py-1" onClick={() => getFocusMonitor().focusVia(field()!, "program")}>
          focusVia(program)
        </button>
      </div>
      <input id="field" ref={field} aria-label="Monitored field" class="monitored rounded border border-slate-300 px-2 py-1" />
      <div id="group" ref={group} class="monitored flex gap-2 rounded border border-slate-300 p-2">
        <button type="button">One</button>
        <button type="button">Two</button>
      </div>
      <p>
        Focus origin: <output id="origin">{origin()}</output>
      </p>
    </section>
  );
}
// #endregion
