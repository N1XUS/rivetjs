import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider with plain CSS",
  summary: "styles.css targets .rv-Slider and its parts with data-orientation / data-dragging / data-focus-visible; one horizontal and one vertical slider.",
  tags: ["slider", "css", "styling", "orientation"],
  status: "experimental",
  frame: { height: 228, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#brightness", "class", "rv-Slider"] },
    { attr: ["#brightness", "data-orientation", "horizontal"] },
    { attr: ["#level", "data-orientation", "vertical"] },
    { attr: ["#level input", "aria-orientation", "vertical"] },
    { press: ["#level input", "ArrowUp"] },
    { expect: ["#level output", "51"] },
  ],
});
