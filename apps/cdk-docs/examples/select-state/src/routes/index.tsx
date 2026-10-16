import { Select, createSelectState, setSelectValue, openSelect, selectedItems } from "@rivetjs/cdk/select";

export const head = { title: "Select with shared state" };

const colors = [
  { key: "red", label: "Red" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
];

// #region demo
export default function Colors() {
  // One state, shared by the Select and the buttons (RAC SelectStateContext).
  const state = createSelectState({ id: "color", items: colors, defaultValue: "green" });
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <Select id="color" label="Color" items={colors} state={state} />
      <div class="flex gap-2">
        <button type="button" id="color-blue" class="rounded border px-2 py-1" onClick={() => setSelectValue(state, "blue")}>
          Blue
        </button>
        <button type="button" id="color-clear" class="rounded border px-2 py-1" onClick={() => setSelectValue(state, null)}>
          Clear
        </button>
        <button type="button" id="color-open" class="rounded border px-2 py-1" onClick={() => openSelect(state, "last")}>
          Open
        </button>
      </div>
      <p id="color-out" class="text-slate-600">
        {selectedItems(state)
          .map((item) => item.label)
          .join(", ") || "nothing"}{" "}
        selected
      </p>
    </section>
  );
}
// #endregion
