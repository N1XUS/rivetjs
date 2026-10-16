import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: Color Space & Channels",
  summary: 'ColorArea demo "Color Space & Channels".',
  tags: ["color-area"],
  status: "experimental",
  frame: { height: 412, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["code", "hsb(219, 58%, 93%)"] },
    { click: "[data-slot=select-trigger] >> nth=0" },
    { click: "[role=option][data-key=rgb]" },
    { expect: ["code", "rgb("] },
    { expect: ["[data-slot=select]:nth-child(2) [data-slot=select-value]", "Blue"] },
  ],
});
