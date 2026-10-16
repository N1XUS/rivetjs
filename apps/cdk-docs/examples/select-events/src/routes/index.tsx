import { signal } from "@rivetjs/reactivity";
import { Select } from "@rivetjs/cdk/select";

export const head = { title: "Select events" };

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
];

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <Select
        id="ev"
        label="Animal"
        items={animals}
        onChange={(value) => add("change:" + String(value))}
        onSelectionChange={(key) => add("selection:" + String(key))}
        onOpenChange={(isOpen) => add("open:" + isOpen)}
        onFocus={() => add("focus")}
        onBlur={() => add("blur")}
        onFocusChange={(isFocused) => add("focused:" + isFocused)}
        onKeyDown={(event) => add("down:" + event.key)}
        onKeyUp={(event) => add("up:" + event.key)}
      />
      <button type="button" id="ev-after" class="justify-self-start rounded border px-2 py-1">
        After
      </button>
      <output id="log" class="text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
