import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: With Icons",
  summary: "Items with a lucide icon before the label.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[role=radio]:nth-of-type(3)" }, { attr: ["[role=radio]:nth-of-type(3)", "aria-checked", "true"] }],
});
