import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Sizes",
  summary: "size sm, md (default) and lg change the item height, padding and text size.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".segment--sm" }, { matches: ".segment--lg" }],
});
