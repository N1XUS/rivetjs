import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: Disabled",
  summary: 'ColorArea demo "Disabled".',
  tags: ["color-area"],
  status: "experimental",
  frame: { height: 794, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-area]", "data-disabled", "true"] }],
});
