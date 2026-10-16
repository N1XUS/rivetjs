import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Usage",
  summary: "A three-item Segment with a sliding selection indicator; one item is always selected.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[role=radio]:nth-of-type(3)" },
    { attr: ["[role=radio]:nth-of-type(3)", "aria-checked", "true"] },
    { attr: ["[role=radio]:nth-of-type(2)", "aria-checked", "false"] },
  ],
});
