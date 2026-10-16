import { signal } from "@rivetjs/reactivity";
import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "CheckboxGroup DOM events and attributes" };

// #region demo
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white";

export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      {/* On the group: its role="group" <div>. */}
      <CheckboxGroup id="dom-cg" lang="it" class="grid gap-2" onPointerEnter={() => add("group:pointerenter")} onWheel={() => add("group:wheel")}>
        <Label>Colori</Label>
        {/* On a CheckboxField: its <div>; on a CheckboxButton: its <label>. */}
        <CheckboxField value="rosso" data-color="red">
          <CheckboxButton class={button} lang="it-CH" onPointerEnter={() => add("rosso:pointerenter")} onDblClick={() => add("rosso:dblclick")}>
            <span class={box} aria-hidden="true">
              <Icon icon={Check} size={14} strokeWidth={3} />
            </span>
            Rosso
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="verde">
          <CheckboxButton class={button}>
            <span class={box} aria-hidden="true">
              <Icon icon={Check} size={14} strokeWidth={3} />
            </span>
            Verde
          </CheckboxButton>
        </CheckboxField>
      </CheckboxGroup>
      <output id="dom-cg-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
