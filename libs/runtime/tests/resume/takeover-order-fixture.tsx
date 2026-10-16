// Resumed bubbling order after a spread takeover (resume-takeover-order-browser.test.ts, runtime-bugs K3-rt-1):
// once a spread element's binding activates, its handlers listen on the element itself while its ancestors stay
// delegated. The ancestors must still run after it (and not at all when it stops propagation).
import { signal } from "@rivetjs/reactivity";

export function Page() {
  (globalThis as any).__componentRuns = ((globalThis as any).__componentRuns ?? 0) + 1;
  const active = signal(0);
  const log = signal<string[]>([]);
  // cdk Checkbox / Switch shape: the input's press handler stops the click, the label's own handler prevents
  // the default (RA useToggle label onClick) — run in the wrong order it undoes the native toggle.
  const stopping = {
    id: "stopping",
    type: "checkbox",
    "aria-label": "stopping",
    "data-active": () => active(),
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      log.update((entries) => [...entries, "inner"]);
    },
  };
  const bubbling = {
    id: "bubbling",
    type: "checkbox",
    "aria-label": "bubbling",
    "data-active": () => active(),
    onClick: () => log.update((entries) => [...entries, "inner2"]),
  };
  return (
    <main>
      <button id="activate" onClick={() => active.set(1)}>
        activate
      </button>
      <label
        id="outer"
        onClick={(event) => {
          event.preventDefault();
          log.update((entries) => [...entries, "outer"]);
        }}
      >
        <input {...stopping} />
      </label>
      <div id="outer2" onClick={() => log.update((entries) => [...entries, "outer2"])}>
        <input {...bubbling} />
      </div>
      <output id="log">{log().join(" ")}</output>
    </main>
  );
}
