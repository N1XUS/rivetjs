import { signal } from "@rivetjs/reactivity";
import { toColor, type Color } from "@rivetjs/cdk/color";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { ColorWheel, ColorWheelTrack } from "@rivetjs/cdk/color-wheel";

export const head = { title: "ColorWheel" };

// #region demo
export default function WheelDemo() {
  const color = signal<string | Color>("hsl(0, 100%, 50%)");
  return (
    <div id="wheel-demo" class="m-4 flex items-center gap-4 text-sm">
      <ColorWheel value={color} outerRadius={90} innerRadius={64}>
        <ColorWheelTrack class="disabled:opacity-40" />
        <ColorThumb class="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)] focus-visible:h-6 focus-visible:w-6 dragging:h-6 dragging:w-6" />
      </ColorWheel>
      <output id="wheel-value" class="font-mono">
        {toColor(color())!.getChannelValue("hue") + "°"}
      </output>
    </div>
  );
}
// #endregion
