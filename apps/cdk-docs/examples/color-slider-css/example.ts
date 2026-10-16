import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider with plain CSS",
  summary: "styles.css targets rv-ColorSlider, rv-SliderTrack, rv-ColorThumb and the data-orientation / data-focus-visible / data-dragging states.",
  tags: ["color-slider", "css", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#css-slider .rv-ColorSlider", "data-orientation", "horizontal"] },
    { press: ["#css-slider input", "ArrowRight"] },
    { attr: ["#css-slider .rv-ColorThumb", "data-focus-visible", "true"] },
    { expect: ["#css-slider output", "51%"] },
  ],
});
