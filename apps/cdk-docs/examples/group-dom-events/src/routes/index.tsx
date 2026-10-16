import { signal } from "@rivetjs/reactivity";
import { Group } from "@rivetjs/cdk/group";

export const head = { title: "Group DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <Group
        id="dom-group"
        lang="cs"
        aria-label="Hledat"
        onPointerEnter={() => add("pointerenter")}
        onHoverChange={(isHovering) => add("hover:" + isHovering)}
        onWheel={() => add("wheel")}
        onDblClick={() => add("dblclick")}
      >
        <input id="dom-group-input" aria-label="Dotaz" class="rounded border border-slate-300 px-2 py-1" />
      </Group>
      <output id="dom-group-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
