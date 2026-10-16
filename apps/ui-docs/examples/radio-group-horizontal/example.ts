import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Horizontal Orientation",
  summary: 'RadioGroup demo "Horizontal Orientation".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=radio-group]", "aria-orientation", "horizontal"] }],
});
