import { signal } from "@rivetjs/reactivity";
import { toColor, type Color } from "@rivetjs/cdk/color";
import { ColorField } from "@rivetjs/cdk/color-field";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "ColorField: hex and channels" };

const field = "grid gap-1";
const input = "w-24 rounded border border-slate-300 px-2 py-1 font-mono focus:outline-2 focus:outline-blue-600 invalid:border-red-600";

// #region demo
export default function Fields() {
  const color = signal<string | Color | null>("#3366cc");
  return (
    <div class="m-4 grid gap-3 text-sm">
      <div id="hex">
        <ColorField value={color} class={field}>
          <Label>Hex</Label>
          <Input class={input} />
        </ColorField>
      </div>
      <div class="flex gap-2">
        <div id="hue">
          <ColorField value={color} colorSpace="hsl" channel="hue" class={field}>
            <Label>Hue</Label>
            <Input class={input} />
          </ColorField>
        </div>
        <ColorField value={color} colorSpace="hsl" channel="saturation" class={field}>
          <Label>Saturation</Label>
          <Input class={input} />
        </ColorField>
        <ColorField value={color} colorSpace="hsl" channel="lightness" class={field}>
          <Label>Lightness</Label>
          <Input class={input} />
        </ColorField>
      </div>
      <output id="field-value" class="font-mono">
        {toColor(color())?.toString("hex") ?? "none"}
      </output>
    </div>
  );
}
// #endregion
