import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Disabled",
  summary: "isDisabled on the root disables every item and dims the track.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=segment]", "aria-disabled", "true"] }],
});
