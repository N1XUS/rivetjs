import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Label } from "@rivetjs/cdk/label";
import { TextArea } from "@rivetjs/cdk/text-area";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Controlled and uncontrolled TextArea" };

const area = "rounded-md border border-slate-300 px-3 py-2";

// #region demo
export default function Notes() {
  const notes = signal("");
  const lines = () => (notes() ? notes().split("\n").length : 0);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      {/* TextField + TextArea part: a multi-line field (RAC TextField with a TextArea). */}
      <TextField id="notes" value={notes} class="grid gap-1">
        <Label class="font-medium">Notes</Label>
        <TextArea rows={3} class={area} />
      </TextField>
      <p class="flex items-center gap-3">
        <span id="notes-count">{lines()} line(s)</span>
        <Button id="notes-clear" class="rounded-md border border-slate-300 px-3 py-1" onPress={() => notes.set("")}>
          Clear
        </Button>
      </p>
      {/* Uncontrolled: starts from defaultValue (also the value a form reset restores). */}
      <TextField id="poem" defaultValue={"Roses are red,\nviolets are blue."} class="grid gap-1">
        <Label class="font-medium">Poem</Label>
        <TextArea rows={2} wrap="off" class={area} />
      </TextField>
    </section>
  );
}
// #endregion
