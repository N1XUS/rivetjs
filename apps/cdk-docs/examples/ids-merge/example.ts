import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "idSignal, mergeIds and useSlotId",
  summary: "A reactive id that mergeIds switches to another id, and useSlotId that only points aria-describedby at slots that rendered.",
  tags: ["cdk", "id"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#check" },
    { expect: ["#slots", "hint: hint, error: none"] },
    { click: "#merge" },
    { attr: ["#label", "data-id", "field-label"] },
    { expect: ["#merged", "merged into field-label"] },
  ],
});
