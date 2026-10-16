import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { FieldError, FieldErrorContext } from "@rivetjs/cdk/form";
import { Label, Text } from "@rivetjs/cdk/label";
import { getValidationResult } from "@rivetjs/cdk/state/form-validation";

export const head = { title: "Label, Text and FieldError DOM events" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  const field = { validation: () => getValidationResult(["Virheellinen arvo."])! };
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <Label id="dom-label" for="dom-input" lang="fi" onClick={() => add("label:click")}>
        Nimi
      </Label>
      <input id="dom-input" class="rounded border border-slate-300 px-2 py-1" />
      <Text id="dom-text" lang="fi" onPointerDown={() => add("text:pointerdown")}>
        Koko nimesi.
      </Text>
      <Provider token={FieldErrorContext} value={field.validation}>
        <FieldError id="dom-error" lang="fi" onPointerEnter={() => add("error:pointerenter")} />
      </Provider>
      <output id="dom-parts-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
