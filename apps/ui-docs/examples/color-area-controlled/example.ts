import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: Controlled",
  summary: 'ColorArea demo "Controlled".',
  tags: ["color-area"],
  status: "experimental",
  frame: { height: 320, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["p span", "#9B80FF"] }, { press: ["[data-slot=color-area] input >> nth=0", "ArrowRight"] }, { expect: ["p span", "#9C80FF"] }],
});
