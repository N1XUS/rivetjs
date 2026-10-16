import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion scroll",
  summary: "A reading-progress bar driven by createScroll and a box that reacts once it scrolls into view with createInView.",
  tags: ["motion", "scroll"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#state", "Scroll down"] }, { wheel: ["#scroller", 900] }, { expect: ["#state", "In view"] }],
});
