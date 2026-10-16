import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Morph: Directions",
  summary: "direction picks the side the surface grows toward; the opposite side stays pinned to the pill.",
  tags: ["morph", "buttons"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "#morph-dir-bottom-end-view" }, { matches: "#morph-dir-bottom-end[data-open]" }],
});
