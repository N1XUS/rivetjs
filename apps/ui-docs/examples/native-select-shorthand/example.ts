import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NativeSelect: Shorthand",
  summary: "Rivet addition: `label`, `description` and `items` props instead of the Label, Trigger with one Option per item and Description.",
  tags: ["native-select"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["select", "Tea"] }, { described: ["select", "Brewed fresh"] }, { matches: "option[value=oolong]:checked" }],
});
