import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion: Drawer exit",
  summary: "Rivet addition: staggered Motion rows inside a Drawer enter after it opens and leave before it closes.",
  tags: ["motion", "drawer", "presence"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "#open" }, { matches: "#rows" }, { click: "#done" }, { absent: "#rows" }],
});
