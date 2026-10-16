import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Bento: Feature highlights",
  summary: 'rowHeight="auto": a native CSS grid sized by its content (dense packing, list semantics) for a marketing section; no script runs.',
  tags: ["bento", "grid", "features", "card"],
  status: "experimental",
  frame: { height: 600 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#bento-features", "role", "list"] }, { matches: '#bento-features .bento__item[data-key="resume"]' }],
});
