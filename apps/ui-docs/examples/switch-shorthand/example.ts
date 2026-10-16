import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Shorthand",
  summary: "Rivet addition: `label` and `description` props instead of the Content / Control / Thumb parts and a Description.",
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=switch-content]" }, { attr: ["[data-slot=switch]", "data-selected", "true"] }],
});
