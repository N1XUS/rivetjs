import { signal } from "@rivetjs/reactivity";
import { Group } from "@rivetjs/cdk/group";

export const head = { title: "Group hover events" };

// #region demo
export default function Zoom() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <Group
        id="zoom"
        aria-label="Zoom"
        class="rv-Group flex w-fit gap-1 rounded border border-slate-300 p-1 data-[hovered]:bg-slate-50"
        onHoverStart={(event) => add("start:" + event.pointerType)}
        onHoverEnd={(event) => add("end:" + event.pointerType)}
        onHoverChange={(isHovering) => add("hover:" + isHovering)}
      >
        <button type="button" id="gh-zoom-in">
          Zoom in
        </button>
        <button type="button">Zoom out</button>
      </Group>
      <p id="gh-outside" class="p-4">
        Outside
      </p>
      <output id="gh-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
