import { signal } from "@rivetjs/reactivity";
import { CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Checkbox DOM events and attributes" };

// #region demo
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white";

export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      {/* On CheckboxField: global events and attributes go on its <div>. */}
      <CheckboxField id="dom-cb" lang="es" data-track="remember" onPointerEnter={() => add("field:pointerenter")}>
        {/* On CheckboxButton: on the <label>; its own press and mousedown handlers run first. */}
        <CheckboxButton
          class={button}
          onPointerEnter={() => add("pointerenter")}
          onMouseDown={() => add("mousedown")}
          onDblClick={() => add("dblclick")}
          onContextMenu={(event) => {
            event.preventDefault();
            add("contextmenu");
          }}
        >
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          Recordarme
        </CheckboxButton>
      </CheckboxField>
      <output id="dom-cb-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
