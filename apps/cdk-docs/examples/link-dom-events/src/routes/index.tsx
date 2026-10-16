import { signal } from "@rivetjs/reactivity";
import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Link DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <p>
        <Link
          id="dom-link"
          lang="ja"
          onPress={() => add("press")}
          onPointerEnter={() => add("pointerenter")}
          onPointerDown={() => add("pointerdown")}
          onDblClick={() => add("dblclick")}
          onContextMenu={(event) => {
            event.preventDefault();
            add("contextmenu");
          }}
        >
          詳しく見る
        </Link>
      </p>
      <output id="dom-link-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
