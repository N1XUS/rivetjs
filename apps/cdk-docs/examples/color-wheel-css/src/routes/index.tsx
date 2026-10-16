import { signal } from "@rivetjs/reactivity";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { ColorWheel, ColorWheelTrack } from "@rivetjs/cdk/color-wheel";

export const head = { title: "ColorWheel with plain CSS and events" };

// #region demo
export default function CssWheel() {
  const changed = signal("");
  const ended = signal("");
  return (
    <div class="demo">
      <div id="css-wheel">
        <ColorWheel
          defaultValue="hsl(240, 100%, 50%)"
          outerRadius={70}
          innerRadius={50}
          onChange={(c) => changed.set("change " + c.getChannelValue("hue"))}
          onChangeEnd={(c) => ended.set("end " + c.getChannelValue("hue"))}
        >
          <ColorWheelTrack />
          <ColorThumb />
        </ColorWheel>
        <output id="wheel-change">{changed()}</output>
        <output id="wheel-end">{ended()}</output>
      </div>
      <div id="off-wheel">
        <ColorWheel defaultValue="hsl(120, 100%, 50%)" outerRadius={50} innerRadius={36} isDisabled>
          <ColorWheelTrack />
          <ColorThumb />
        </ColorWheel>
      </div>
    </div>
  );
}
// #endregion
