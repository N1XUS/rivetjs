import { signal } from "@rivetjs/reactivity";
import { ColorField } from "@rivetjs/cdk/color-field";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "ColorField events, states and render props" };

const input = "w-28 rounded border border-slate-300 px-2 py-1 font-mono";

// #region demo
export default function FieldEvents() {
  const changed = signal("");
  const focused = signal("");
  return (
    <div class="m-4 grid gap-3 text-sm">
      <div id="ev-field">
        <ColorField
          defaultValue="#ff0000"
          onChange={(c) => changed.set("change " + (c ? c.toString("hex") : "null"))}
          onFocusChange={(f) => focused.set("focused " + f)}
          class={({ isInvalid }) => "grid gap-1 " + (isInvalid() ? "text-red-700" : "")}
        >
          <Label>Background</Label>
          <Input class={input} />
        </ColorField>
        <output id="ev-change" class="block font-mono">
          {changed()}
        </output>
        <output id="ev-focus" class="block font-mono">
          {focused()}
        </output>
      </div>
      <div class="flex gap-3">
        <div id="ro-field">
          <ColorField defaultValue="#00aa00" isReadOnly class="grid gap-1">
            <Label>Read-only</Label>
            <Input class={input} />
          </ColorField>
        </div>
        <div id="off-field">
          <ColorField defaultValue="#999999" isDisabled class="grid gap-1 disabled:opacity-50">
            <Label>Disabled</Label>
            <Input class={input} />
          </ColorField>
        </div>
        <div id="req-field">
          <ColorField isRequired name="accent" class="grid gap-1">
            <Label>Required</Label>
            <Input class={input} placeholder="#RRGGBB" />
          </ColorField>
        </div>
      </div>
    </div>
  );
}
// #endregion
