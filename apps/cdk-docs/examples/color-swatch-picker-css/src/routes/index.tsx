import { signal } from "@rivetjs/reactivity";
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
import { ColorSwatchPicker, ColorSwatchPickerItem } from "@rivetjs/cdk/color-swatch-picker";

export const head = { title: "ColorSwatchPicker with plain CSS" };

// #region demo
export default function StackPicker() {
  const changed = signal("");
  return (
    <div class="demo">
      <ColorSwatchPicker id="stack" layout="stack" defaultValue="#0f0" aria-label="Theme" onChange={(c) => changed.set(c.getColorName("en-US"))}>
        <ColorSwatchPickerItem color="#f00">
          {({ color }) => (
            <>
              <ColorSwatch />
              <span class="name">{color().toString("hex")}</span>
            </>
          )}
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#0f0">
          {({ color }) => (
            <>
              <ColorSwatch />
              <span class="name">{color().toString("hex")}</span>
            </>
          )}
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#00f">
          {({ color }) => (
            <>
              <ColorSwatch />
              <span class="name">{color().toString("hex")}</span>
            </>
          )}
        </ColorSwatchPickerItem>
      </ColorSwatchPicker>
      <output id="stack-change">{changed()}</output>
    </div>
  );
}
// #endregion
