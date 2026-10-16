import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Two Items",
  summary: "A two-option Segment as a compact on / off style switch between two modes.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["[role=radio]:nth-of-type(2)", "ArrowLeft"] },
    { focused: "[role=radio]:nth-of-type(1)" },
    { key: " " },
    { attr: ["[role=radio]:nth-of-type(1)", "aria-checked", "true"] },
  ],
});
