import { signal } from "@rivetjs/reactivity";
import { toColor, type Color } from "@rivetjs/cdk/color";
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
import { ColorSwatchPicker, ColorSwatchPickerItem } from "@rivetjs/cdk/color-swatch-picker";

export const head = { title: "ColorSwatchPicker" };

const item = "rounded-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 data-[selected]:ring-2 data-[selected]:ring-slate-900";
const swatch = "h-8 w-8 rounded";

// #region demo
export default function SwatchPicker() {
  const color = signal<string | Color>("#3b82f6");
  return (
    <div class="m-4 grid gap-2 text-sm">
      <ColorSwatchPicker id="swatches" value={color} class="flex gap-2">
        <ColorSwatchPickerItem color="#3b82f6" class={item}>
          <ColorSwatch class={swatch} />
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#ef4444" class={item}>
          <ColorSwatch class={swatch} />
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#f59e0b" class={item}>
          <ColorSwatch class={swatch} />
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#10b981" class={item}>
          <ColorSwatch class={swatch} />
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#8b5cf6" isDisabled class={item + " opacity-40"}>
          <ColorSwatch class={swatch} />
        </ColorSwatchPickerItem>
      </ColorSwatchPicker>
      <output id="picked" class="font-mono">
        {toColor(color())!.toString("hex")}
      </output>
    </div>
  );
}
// #endregion
