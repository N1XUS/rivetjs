import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/cdk/label";
import { TextArea } from "@rivetjs/cdk/text-area";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextArea events" };

// #region demo
export default function AreaEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <TextField
        id="ta-ev"
        class="grid gap-1"
        onChange={(value) => add("change:" + value.replaceAll("\n", "\\n"))}
        onInput={() => add("input")}
        onFocus={() => add("focus")}
        onBlur={() => add("blur")}
        onFocusChange={(isFocused) => add("focus:" + isFocused)}
        onKeyDown={(event) => add("keydown:" + event.key)}
        onKeyUp={(event) => add("keyup:" + event.key)}
      >
        <Label>Reply</Label>
        <TextArea rows={2} class="rounded-md border border-slate-300 px-3 py-2" />
      </TextField>
      <output id="ta-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
