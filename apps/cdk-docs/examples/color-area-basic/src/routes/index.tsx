import { signal } from "@rivetjs/reactivity";
import { toColor, type Color } from "@rivetjs/cdk/color";
import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";

export const head = { title: "ColorArea: saturation \u00d7 brightness" };

// #region demo
export default function AreaDemo() {
  // A two-way Signal: the area writes the new color back. Keep strings in signals on resumed pages.
  const color = signal<string | Color>("hsb(220, 60%, 80%)");
  return (
    <div id="area-demo" class="m-4 flex items-start gap-4 text-sm">
      <ColorArea value={color} colorSpace="hsb" xChannel="saturation" yChannel="brightness" class="h-40 w-40 rounded-lg">
        <ColorThumb class="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)] focus-visible:h-6 focus-visible:w-6 dragging:h-6 dragging:w-6" />
      </ColorArea>
      <output id="area-value" class="font-mono">
        {toColor(color())!.toString("hsb")}
      </output>
    </div>
  );
}
// #endregion
