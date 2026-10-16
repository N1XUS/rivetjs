import { signal } from "@rivetjs/reactivity";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextField DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <TextField
        id="dom-tf"
        class="grid gap-1"
        lang="sv"
        // Global DOM events: on the root <div>.
        onPointerEnter={() => add("root:pointerenter")}
        onDblClick={() => add("root:dblclick")}
        // Text input events: on the <input>.
        onBeforeInput={(event) => add("beforeinput:" + event.data)}
        onPaste={() => add("paste")}
        onCopy={() => add("copy")}
        onSelect={() => add("select")}
        onCompositionStart={() => add("composition")}
      >
        <Label>Namn</Label>
        {/* Native attributes of the input go on the Input part. */}
        <Input class="rounded-md border border-slate-300 px-3 py-1.5" title="Ditt namn" />
      </TextField>
      <output id="dom-tf-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
