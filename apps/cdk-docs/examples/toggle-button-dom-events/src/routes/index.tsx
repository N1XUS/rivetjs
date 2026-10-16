import { signal } from "@rivetjs/reactivity";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "ToggleButton DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const on = signal(false);
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      <ToggleButton
        id="dom-tb"
        lang="de"
        isSelected={on}
        onPointerEnter={() => add("pointerenter")}
        onPointerDown={() => add("pointerdown")}
        onClick={() => add("click:" + on())}
        onDblClick={() => add("dblclick")}
        onContextMenu={(event) => {
          event.preventDefault();
          add("contextmenu");
        }}
      >
        Stumm
      </ToggleButton>
      <output id="dom-tb-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
