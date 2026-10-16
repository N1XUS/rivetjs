import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: Usage",
  summary: 'ColorArea demo "Usage".',
  tags: ["color-area"],
  status: "experimental",
  frame: { height: 794, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ press: ["[data-slot=color-area] input >> nth=0", "ArrowRight"] }, { matches: "[data-slot=color-area-thumb][data-focus-visible=true]" }],
});
