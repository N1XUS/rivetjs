import { signal } from "@rivetjs/reactivity";
import { Switch } from "@rivetjs/cdk/switch";

export const head = { title: "Switch DOM events and attributes" };

// #region demo
const button = "group flex cursor-pointer items-center gap-3";
const track =
  "relative h-6 w-11 rounded-full bg-slate-300 transition group-data-[selected]:bg-teal-700 " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2 " +
  "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition " +
  "group-data-[selected]:after:translate-x-5";

export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      {/* Global events and attributes go on the <label>; its own press and mousedown handlers run first. */}
      <Switch
        id="dom-sw"
        class={button}
        lang="nl"
        data-setting="notifications"
        onPointerEnter={() => add("pointerenter")}
        onMouseDown={() => add("mousedown")}
        onDblClick={() => add("dblclick")}
        onContextMenu={(event) => {
          event.preventDefault();
          add("contextmenu");
        }}
      >
        <span class={track} aria-hidden="true" />
        Meldingen
      </Switch>
      <output id="dom-sw-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
