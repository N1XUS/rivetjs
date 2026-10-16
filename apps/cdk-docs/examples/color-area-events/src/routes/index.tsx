import { signal } from "@rivetjs/reactivity";
import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";

export const head = { title: "ColorArea events and options" };

// #region demo
export default function AreaEvents() {
  const changed = signal("");
  const ended = signal("");
  return (
    <div class="m-4 flex gap-6 text-sm">
      <div id="rgb-area" class="grid gap-2">
        <ColorArea
          defaultValue="rgb(128, 64, 64)"
          xChannel="red"
          yChannel="green"
          xName="red"
          yName="green"
          aria-label="Red and green"
          class="h-32 w-32 rounded"
          onChange={(c) => changed.set("change " + c.toString("rgb"))}
          onChangeEnd={(c) => ended.set("end " + c.toString("rgb"))}
        >
          <ColorThumb class="h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)] focus-visible:h-6 focus-visible:w-6 dragging:h-6 dragging:w-6" />
        </ColorArea>
        <output id="area-change" class="font-mono">
          {changed()}
        </output>
        <output id="area-end" class="font-mono">
          {ended()}
        </output>
      </div>
      <div id="disabled-area">
        <ColorArea defaultValue="#7f007f" isDisabled aria-label="Disabled" class="h-32 w-32 rounded disabled:opacity-40">
          <ColorThumb class="h-5 w-5 rounded-full border-2 border-white" />
        </ColorArea>
      </div>
    </div>
  );
}
// #endregion
