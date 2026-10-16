import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/cdk/label";
import { TextArea } from "@rivetjs/cdk/text-area";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextArea DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <TextField
        id="dom-ta"
        class="grid gap-1"
        dir="ltr"
        // Global DOM events: on the root <div>.
        onPointerEnter={() => add("root:pointerenter")}
        onWheel={() => add("root:wheel")}
        // Text input events: on the <textarea>.
        onBeforeInput={(event) => add("beforeinput:" + event.data)}
        onCut={() => add("cut")}
        onPaste={() => add("paste")}
        onSelect={() => add("select")}
      >
        <Label>Notes</Label>
        <TextArea rows={2} class="rounded-md border border-slate-300 px-3 py-2" />
      </TextField>
      <output id="dom-ta-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
