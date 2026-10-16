import { signal } from "@rivetjs/reactivity";
import { Toolbar } from "@rivetjs/cdk/toolbar";

export const head = { title: "Toolbar DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid gap-3 text-sm">
      <Toolbar
        id="dom-tools"
        lang="uk"
        aria-label="Інструменти"
        class="flex gap-1"
        onPointerEnter={() => add("pointerenter")}
        onPointerDown={() => add("pointerdown")}
        onWheel={() => add("wheel")}
      >
        <button type="button" id="dom-t1">
          Один
        </button>
        <button type="button" id="dom-t2">
          Два
        </button>
      </Toolbar>
      <output id="dom-tools-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
