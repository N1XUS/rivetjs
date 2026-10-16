import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: Render Function",
  summary: 'ColorArea demo "Render Function".',
  tags: ["color-area"],
  status: "experimental",
  frame: { height: 794, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-area]", "data-custom", "slider"] }, { attr: ["[data-slot=color-area-thumb]", "data-custom", "thumb"] }],
});
