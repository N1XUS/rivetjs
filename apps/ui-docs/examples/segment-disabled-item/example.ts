import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Disabled Item",
  summary: "isDisabled on one Segment.Item: it cannot be selected and arrow keys skip it.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[role=radio]:nth-of-type(3)", "disabled", ""] }],
});
