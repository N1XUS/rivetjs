import { For } from "@rivetjs/runtime/dom";
import { createSelection, extendTo, firstSelected, isSelected, keyId, selectKey, type Key } from "@rivetjs/cdk/collections";

export const head = { title: "Selection helpers" };

const days = ["mon", "tue", "wed", "thu", "fri"];

// #region demo
export default function Days() {
  // Single: selectKey replaces; toggleSingle lets a second press clear it.
  const single = createSelection({ mode: "single", toggleSingle: true });
  // Multiple: selectKey toggles and sets the anchor; extendTo adds the range from the anchor.
  const multiple = createSelection({ mode: "multiple", defaultSelected: ["mon"] });
  const onPick = (event: MouseEvent, key: Key) => (event.shiftKey ? extendTo(multiple, days, key) : selectKey(multiple, key));
  return (
    <section class="m-4 grid gap-3 text-sm">
      <div class="flex gap-1">
        <For each={() => days} by={(day) => day}>
          {(day) => (
            <button
              id={keyId("single", day())}
              type="button"
              aria-pressed={isSelected(single, day()) ? "true" : "false"}
              class="rounded border border-slate-300 px-2 aria-pressed:bg-teal-700 aria-pressed:text-white"
              onClick={() => selectKey(single, day())}
            >
              {day()}
            </button>
          )}
        </For>
        <output id="single-value" class="ml-2 text-slate-600">
          firstSelected: {String(firstSelected(single))}
        </output>
      </div>
      <div class="flex gap-1">
        <For each={() => days} by={(day) => day}>
          {(day) => (
            <button
              id={keyId("multi", day())}
              type="button"
              aria-pressed={isSelected(multiple, day()) ? "true" : "false"}
              class="rounded border border-slate-300 px-2 aria-pressed:bg-teal-700 aria-pressed:text-white"
              onClick={(event) => onPick(event, day())}
            >
              {day()}
            </button>
          )}
        </For>
        <button id="extend-fri" type="button" class="ml-2 rounded border border-slate-300 px-2" onClick={() => extendTo(multiple, days, "fri")}>
          extendTo("fri")
        </button>
        <output id="multi-value" class="ml-2 text-slate-600">
          {days.filter((day) => isSelected(multiple, day)).join(", ") || "none"}
        </output>
      </div>
    </section>
  );
}
// #endregion
