import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Features and Add-ons Example",
  summary: 'CheckboxGroup demo "Features and Add-ons Example".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 428, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=checkbox-content] svg" }],
});
