import { signal } from "@rivetjs/reactivity";
import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "RadioGroup events" };

// #region demo
export default function Pets() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <RadioGroup
        label="Pet"
        onChange={(value) => add("change:" + value)}
        // Group events are focus-within: moving between radios does not fire them.
        onFocus={() => add("group:focus")}
        onBlur={() => add("group:blur")}
        onFocusChange={(isFocusWithin) => add("within:" + isFocusWithin)}
        items={[
          {
            value: "dog",
            label: "Dog",
            id: "pet-dog",
            onFocusChange: (isFocused) => add("dog:focus:" + isFocused),
            onKeyDown: (event) => add("dog:keydown:" + event.key),
          },
          { value: "cat", label: "Cat", id: "pet-cat" },
        ]}
      />
      <button type="button">After</button>
      <output id="rg-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
