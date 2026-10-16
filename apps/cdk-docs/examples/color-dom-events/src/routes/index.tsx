import { signal } from "@rivetjs/reactivity";
import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorField } from "@rivetjs/cdk/color-field";
import { ColorSwatch } from "@rivetjs/cdk/color-swatch";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "Color components: DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal("");
  return (
    <div class="m-4 flex items-start gap-4 text-sm">
      <ColorArea id="dom-area" lang="de" defaultValue="#ff8800" aria-label="Color" class="h-24 w-24 rounded" onDblClick={() => log.set("area dblclick")}>
        <ColorThumb class="h-4 w-4 rounded-full border-2 border-white" />
      </ColorArea>
      <ColorSwatch
        id="dom-swatch"
        color="#ff8800"
        class="h-10 w-10 rounded"
        {...{ "data-tone": "warm" }}
        onContextMenu={(e) => {
          e.preventDefault();
          log.set("swatch contextmenu");
        }}
      />
      <div id="dom-field">
        <ColorField defaultValue="#ff8800" class="grid gap-1" onPointerEnter={() => log.set("field pointerenter")}>
          <Label>Hex</Label>
          <Input class="w-24 rounded border border-slate-300 px-2 py-1 font-mono" />
        </ColorField>
      </div>
      <output id="dom-log" class="font-mono">
        {log()}
      </output>
    </div>
  );
}
// #endregion
