import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider: hue",
  summary: "A hue ColorSlider with a Label, a SliderOutput and a SliderTrack holding the ColorThumb; Page keys step by 15\u00b0.",
  tags: ["color-slider", "color-thumb", "slider", "tailwind"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#hue-demo .rv-Label", "Hue"] },
    { expect: ["#hue-demo output", "0°"] },
    { press: ["#hue-demo input", "PageUp"] },
    { expect: ["#hue-demo output", "15°"] },
    { attr: ["#hue-demo input", "aria-valuetext", "15°, red orange"] },
  ],
});
