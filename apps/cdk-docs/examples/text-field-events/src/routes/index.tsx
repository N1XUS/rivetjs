import { signal } from "@rivetjs/reactivity";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextField events" };

// #region demo
export default function FieldEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <TextField
        id="tf-ev"
        class="grid gap-1"
        onChange={(value) => add("change:" + value)}
        // Runs after the field's own input handler (the value is already updated).
        onInput={(event) => add("input:" + (event.currentTarget as HTMLInputElement).value)}
        onFocus={() => add("focus")}
        onBlur={() => add("blur")}
        onFocusChange={(isFocused) => add("focus:" + isFocused)}
        onKeyDown={(event) => add("keydown:" + event.key)}
        onKeyUp={(event) => add("keyup:" + event.key)}
      >
        <Label>Message</Label>
        <Input class="rounded-md border border-slate-300 px-3 py-1.5" />
      </TextField>
      <output id="tf-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
