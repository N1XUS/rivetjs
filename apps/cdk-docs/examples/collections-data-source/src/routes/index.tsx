import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { ArrayDataSource, isDataSource, type DataSource } from "@rivetjs/cdk/collections/data-source";
import { UniqueSelectionDispatcher } from "@rivetjs/cdk/collections/unique-selection-dispatcher";

export const head = { title: "DataSource and UniqueSelectionDispatcher" };

const viewer = { viewChange: () => ({ start: 0, end: Number.MAX_VALUE }) };

// One dispatcher per scope (Angular provides one at the root).
const dispatcher = new UniqueSelectionDispatcher();
const listening = { done: false };

// #region demo
export default function Sources() {
  const names = signal(["Ada", "Alan"]);
  // connect() returns an accessor: read it in a binding or a For.
  const source: DataSource<string> = new ArrayDataSource(names);
  const rows = source.connect(viewer);
  // A class instance cannot be captured by a binding: read what you need while rendering.
  const detected = `isDataSource(source): ${isDataSource(source)}, isDataSource([]): ${isDataSource([])}`;
  const checked = signal("none");
  const notices = signal<string[]>([]);
  // Radio-like items in different places: each listens, the chosen one notifies the others.
  const choose = (id: string) => {
    if (!listening.done) {
      listening.done = true;
      for (const item of ["a", "b", "c"]) dispatcher.listen((chosen, name) => chosen !== item && name === "plan" && notices.update((list) => [...list, item]));
    }
    notices.set([]);
    dispatcher.notify(id, "plan");
    checked.set(id);
  };
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-1">
        <ul id="names" class="m-0 list-disc pl-5">
          <For each={rows} by={(name) => name}>
            {(name) => <li>{name()}</li>}
          </For>
        </ul>
        <button id="add" type="button" class="rounded border border-slate-300 px-2" onClick={() => names.update((list) => [...list, "Grace"])}>
          Add Grace
        </button>
        <p id="is-source" class="text-slate-600">
          {detected}
        </p>
      </div>
      <div class="grid content-start gap-1">
        <div class="flex gap-1">
          <button id="pick-a" type="button" class="rounded border border-slate-300 px-2" onClick={() => choose("a")}>
            a
          </button>
          <button id="pick-b" type="button" class="rounded border border-slate-300 px-2" onClick={() => choose("b")}>
            b
          </button>
          <button id="pick-c" type="button" class="rounded border border-slate-300 px-2" onClick={() => choose("c")}>
            c
          </button>
        </div>
        <output id="dispatch" class="text-slate-600">
          checked {checked()}; notified to uncheck: {notices().join(", ") || "none"}
        </output>
      </div>
    </section>
  );
}
// #endregion
