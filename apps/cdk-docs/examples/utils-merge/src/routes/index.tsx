import { signal } from "@rivetjs/reactivity";
import { chain, mergeProps, mergeRefs } from "@rivetjs/cdk/utils";

export const head = { title: "mergeProps()" };

const base = { class: "rounded-md border px-3 py-1", "data-size": "sm" };
const variant = { class: "border-teal-700 text-teal-800", "data-size": "lg" };

// #region demo
export default function Merging() {
  const log = signal<string[]>([]);
  const add = (line: string) => log.update((lines) => [...lines, line]);
  // mergeProps() (React Aria): class joined, later keys win. Attribute-only bags are safe to spread on
  // server-rendered markup; aria id lists are not joined (later wins), so join them yourself.
  const attrs = mergeProps(base, variant, { id: "save", type: "button" as const, "aria-describedby": ["hint", "status"].join(" ") });
  return (
    <section class="m-4 grid max-w-lg gap-2 text-sm">
      <p id="hint" class="text-slate-500">
        Saves the draft.
      </p>
      <p id="status" class="text-slate-500">
        Not saved.
      </p>
      <button
        {...attrs}
        onClick={() => {
          // Handlers chained (earlier first), class joined, refs merged. mergeProps lives in a
          // resume-compiled module, so merged handlers resume when spread on a native element.
          const props = mergeProps({ onPress: () => add("first"), class: "a" }, { onPress: () => add("second"), class: "b" });
          props.onPress();
          chain(
            () => add("chain 1"),
            undefined,
            () => add("chain 2"),
          )();
          const seen: string[] = [];
          const ref = { current: null as string | null };
          (mergeRefs<string>((value) => void seen.push(String(value)), ref) as (value: string) => void)("node");
          add(`class "${props.class}", refs ${seen[0]}/${ref.current}`);
        }}
      >
        Save
      </button>
      <pre id="attrs" class="overflow-x-auto rounded bg-slate-100 p-2 text-xs">
        {JSON.stringify(attrs, null, 1)}
      </pre>
      <ol id="log" class="list-decimal ps-6">
        {log().map((line) => (
          <li>{line}</li>
        ))}
      </ol>
    </section>
  );
}
// #endregion
