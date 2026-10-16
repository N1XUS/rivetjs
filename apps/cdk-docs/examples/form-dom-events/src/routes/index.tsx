import { signal } from "@rivetjs/reactivity";
import { Form } from "@rivetjs/cdk/form";

export const head = { title: "Form DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <Form
        id="dom-form"
        lang="pl"
        dir="ltr"
        class="rounded border border-slate-200 p-3"
        onPointerEnter={() => add("pointerenter")}
        onPointerDown={() => add("pointerdown")}
        onSubmit={(event) => event.preventDefault()}
      >
        <input id="dom-form-input" aria-label="Imię" class="rounded border border-slate-300 px-2 py-1" />
      </Form>
      <output id="dom-form-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
