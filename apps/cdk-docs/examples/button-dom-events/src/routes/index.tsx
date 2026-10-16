import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Button DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      <Button
        id="dom-btn"
        lang="fr"
        dir="ltr"
        onPress={() => add("press")}
        onPointerEnter={() => add("pointerenter")}
        onPointerLeave={() => add("pointerleave")}
        onPointerDown={() => add("pointerdown")}
        onDblClick={() => add("dblclick")}
        onContextMenu={(event) => {
          event.preventDefault();
          add("contextmenu");
        }}
      >
        Enregistrer
      </Button>
      <output id="dom-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
