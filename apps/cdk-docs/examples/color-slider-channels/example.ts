import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSlider channels, orientation, disabled",
  summary: "Alpha and lightness channels over one Signal, a vertical slider, and a disabled slider; the track gradient follows the current color.",
  tags: ["color-slider", "signal", "orientation", "disabled", "tailwind"],
  status: "experimental",
  frame: { height: 220, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#alpha output", "100%"] },
    { press: ["#alpha input", "ArrowLeft"] },
    { expect: ["#alpha output", "99%"] },
    { expect: ["#channels-value", "hsla(200, 80%, 50%, 0.99)"] },
    { attr: ["#vertical input", "aria-orientation", "vertical"] },
    { attr: ["#disabled-slider input", "disabled", ""] },
  ],
});
