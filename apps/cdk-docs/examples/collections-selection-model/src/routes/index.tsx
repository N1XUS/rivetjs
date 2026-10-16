import { signal, type Signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { SelectionModel, type SelectionChange } from "@rivetjs/cdk/collections/selection-model";

export const head = { title: "SelectionModel" };

const toppings = ["cheese", "basil", "olives", "chili"];

// A class instance: it lives in the browser module, created when the first handler loads.
// The page state the server renders is in signals; the model is the client-side store.
const model = new SelectionModel<string>(true, ["cheese"]);

// Single selection; compareWith matches values by id, so fresh objects find the selected one.
const single = new SelectionModel<{ id: number }>(false, [], true, (a, b) => a.id === b.id);

/** Subscribe once (per page load) and mirror the model into signals. */
function connect(selected: Signal<string[]>, log: Signal<{ id: number; text: string }[]>) {
  if (model.changed.observed) return;
  model.changed.subscribe((change: SelectionChange<string>) => {
    selected.set([...change.source.selected]);
    log.update((entries) => [...entries, { id: entries.length, text: `added [${change.added}] removed [${change.removed}]` }]);
  });
}

// #region demo
export default function Toppings() {
  const selected = signal(["cheese"]);
  const log = signal<{ id: number; text: string }[]>([]);
  const singleText = signal("none");
  const pick = (id: number) => {
    single.select({ id });
    singleText.set(
      `${single.selected.map((value) => value.id)} (isSelected({ id: 1 }): ${single.isSelected({ id: 1 })}, multiple: ${single.isMultipleSelection()})`,
    );
  };
  const run = (action: (m: SelectionModel<string>) => unknown) => {
    connect(selected, log);
    action(model);
  };
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-1 [&_button]:rounded [&_button]:border [&_button]:border-slate-300 [&_button]:px-2">
        <div class="flex flex-wrap gap-1">
          <For each={() => toppings} by={(t) => t}>
            {(topping) => (
              <button
                id={"toggle-" + topping()}
                type="button"
                aria-pressed={selected().includes(topping()) ? "true" : "false"}
                onClick={() => run((m) => m.toggle(topping()))}
              >
                toggle("{topping()}")
              </button>
            )}
          </For>
        </div>
        <div class="flex flex-wrap gap-1">
          <button id="select-two" type="button" onClick={() => run((m) => m.select("olives", "chili"))}>
            select("olives", "chili")
          </button>
          <button id="deselect-cheese" type="button" onClick={() => run((m) => m.deselect("cheese"))}>
            deselect("cheese")
          </button>
          <button id="set" type="button" onClick={() => run((m) => m.setSelection("basil"))}>
            setSelection("basil")
          </button>
          <button id="clear" type="button" onClick={() => run((m) => m.clear())}>
            clear()
          </button>
        </div>
        <output id="selected" class="text-slate-700">
          selected: {selected().join(", ") || "none"}
        </output>
        <div class="mt-2 flex flex-wrap items-center gap-1">
          <button id="single-1" type="button" onClick={() => pick(1)}>
            select({"{ id: 1 }"})
          </button>
          <button id="single-2" type="button" onClick={() => pick(2)}>
            select({"{ id: 2 }"})
          </button>
        </div>
        <output id="single" class="text-slate-700">
          single: {singleText()}
        </output>
      </div>
      <ol id="log" class="m-0 list-decimal pl-5 text-slate-600">
        <For each={log} by={(entry) => entry.id}>
          {(entry) => <li>{entry().text}</li>}
        </For>
      </ol>
    </section>
  );
}
// #endregion
