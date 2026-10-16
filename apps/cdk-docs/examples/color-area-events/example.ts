import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea events and options",
  summary:
    "onChange fires while the value changes, onChangeEnd when a drag or key press ends; channels in RGB, a disabled area, and hidden-input names for forms.",
  tags: ["color-area", "events", "disabled", "tailwind"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { press: ["#rgb-area input", "ArrowRight"] },
    { expect: ["#area-change", "change rgb(129, 64, 64)"] },
    { expect: ["#area-end", "end rgb(129, 64, 64)"] },
    { attr: ["#disabled-area [role=group]", "data-disabled", "true"] },
    { attr: ["#disabled-area input", "disabled", ""] },
    { attr: ["#rgb-area input", "name", "red"] },
  ],
});
