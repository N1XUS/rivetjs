import { ColorSwatch } from "@rivetjs/cdk/color-swatch";

export const head = { title: "ColorSwatch" };

const swatch = "h-10 w-10 rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]";

// #region demo
export default function Swatches() {
  return (
    <div class="m-4 flex items-center gap-3 text-sm">
      <ColorSwatch id="sw-red" color="#f00" class={swatch} />
      <ColorSwatch id="sw-named" color="#e11" colorName="Fire truck red" class={swatch} />
      <ColorSwatch id="sw-labelled" color="#00f" aria-label="Background" class={swatch} />
      <ColorSwatch id="sw-alpha" color="rgba(0, 255, 0, 0.5)" class={swatch} />
      <ColorSwatch color="#7f007f" class="flex h-10 w-24 items-center justify-center rounded-md text-white">
        {({ color }) => <span id="sw-hex">{color().toString("hex")}</span>}
      </ColorSwatch>
    </div>
  );
}
// #endregion
