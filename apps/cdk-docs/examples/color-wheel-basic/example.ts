import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorWheel",
  summary:
    "A ColorWheel (outer/inner radius) with its ColorWheelTrack and a ColorThumb over a Signal; arrows step the hue by 1\u00b0, Page keys snap to 15\u00b0 steps.",
  tags: ["color-wheel", "color-thumb", "signal", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#wheel-value", "0°"] },
    { press: ["#wheel-demo input", "ArrowRight"] },
    { expect: ["#wheel-value", "1°"] },
    { press: ["#wheel-demo input", "PageUp"] },
    { expect: ["#wheel-value", "15°"] },
    { attr: ["#wheel-demo input", "aria-valuetext", "15°, red orange"] },
  ],
});
