import { signal } from "@rivetjs/reactivity";
import { SearchField } from "../components/SearchField.tsx";

export const head = { title: "DOM props in your own component" };

// #region demo
export default function Page() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-5), entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <SearchField
        id="field"
        label="Search"
        lang="en"
        onPointerEnter={() => add("root:enter")}
        onInput={(e) => add("input:" + e.currentTarget.value)}
        onPaste={() => add("input:paste")}
      />
      <output id="log" class="block font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
