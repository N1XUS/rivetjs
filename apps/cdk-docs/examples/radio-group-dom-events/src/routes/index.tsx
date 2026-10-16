import { signal } from "@rivetjs/reactivity";
import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "RadioGroup DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <RadioGroup
        id="dom-rg"
        lang="pt"
        label="Resposta"
        onPointerDown={() => add("group:pointerdown")}
        onDblClick={() => add("group:dblclick")}
        items={[
          { value: "sim", label: "Sim", id: "dom-sim", lang: "pt-BR", onPointerEnter: () => add("sim:pointerenter") },
          { value: "nao", label: "Não", id: "dom-nao" },
        ]}
      />
      <output id="dom-rg-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
