import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip: With Arrow",
  summary: 'Tooltip demo "With Arrow".',
  tags: ["tooltip"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ hover: "button:nth-of-type(1)" }, { matches: "[role=tooltip] [data-slot=overlay-arrow]" }],
});
