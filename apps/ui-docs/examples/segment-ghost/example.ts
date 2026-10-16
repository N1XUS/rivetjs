import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Ghost",
  summary: 'variant="ghost": a transparent track with an accent-tinted indicator, for toolbars and headers.',
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[role=radio]:nth-of-type(1)" }, { attr: ["[role=radio]:nth-of-type(1)", "aria-checked", "true"] }],
});
