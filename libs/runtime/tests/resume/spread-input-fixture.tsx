// Resumed spread-bound form controls (resume-spread-input-browser.test.ts): the first, cold keystroke /
// Space press must survive the spread binding's activation (cdk fields spread globalDOMProps this way).
import { signal } from "@rivetjs/reactivity";

export function Page() {
  (globalThis as any).__componentRuns = ((globalThis as any).__componentRuns ?? 0) + 1;
  const text = signal("");
  const on = signal(false);
  // A keydown handler on an ancestor writing state the spread reads (cdk ComboBox: focus / key state on
  // the wrapper): it runs first in the cold replay, so the spread binding activates (at once: the spread
  // owns no keydown handler) before the input / change handler sees the control.
  const keys = signal(0);
  const field = {
    id: "field",
    type: "text",
    "aria-label": "name",
    class: "rv-Input",
    "data-keys": () => keys(),
    value: () => text(),
    onInput: (event: InputEvent) => text.set((event.target as HTMLInputElement).value),
  };
  const box = {
    id: "box",
    type: "checkbox",
    "aria-label": "agree",
    "data-keys": () => keys(),
    checked: () => on(),
    onChange: (event: Event) => on.set((event.target as HTMLInputElement).checked),
  };
  return (
    <main onKeyDown={() => keys.update((n) => n + 1)}>
      <input {...field} />
      <input {...box} />
      <output id="text">{text()}</output>
      <output id="on">{String(on())}</output>
    </main>
  );
}
