import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: saturation \u00d7 brightness",
  summary: "A two-dimensional ColorArea over a two-way Signal (HSB saturation on x, brightness on y) with a ColorThumb; arrow keys and drags change the color.",
  tags: ["color-area", "color-thumb", "signal", "tailwind"],
  status: "experimental",
  frame: { height: 192, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#area-demo [role=group]", "class", "h-40 w-40 rounded-lg"] },
    { attr: ["#area-demo input", "aria-roledescription", "2D slider"] },
    { expect: ["#area-value", "hsb(220, 60%, 80%)"] },
    { press: ["#area-demo input", "ArrowRight"] },
    { expect: ["#area-value", "hsb(220, 61%, 80%)"] },
    { press: ["#area-demo input", "ArrowUp"] },
    { expect: ["#area-value", "hsb(220, 61%, 81%)"] },
  ],
});
