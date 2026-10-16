import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: Shorthand",
  summary: "Rivet addition: a `Stepper.Step` with `title` / `description` and no children renders the indicator, title, description and separator.",
  tags: ["stepper"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["li:first-child", "data-status", "complete"] }, { expect: ["li:nth-child(2) [data-slot=stepper-title]", "Members"] }],
});
