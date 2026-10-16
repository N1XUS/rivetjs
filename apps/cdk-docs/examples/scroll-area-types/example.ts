import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea types",
  summary:
    "The four scrollbar visibility types: auto (while overflowing), always, scroll (while scrolling) and hover (pointer over the area), with scrollHideDelay.",
  tags: ["scroll-area", "type", "scrollHideDelay", "css"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: '#always-scrollbar[data-state="visible"]' },
    { matches: '#auto-scrollbar[data-state="visible"]' },
    { absent: "#hover-scrollbar" },
    { hover: "#hover-viewport" },
    { matches: '#hover-scrollbar[data-state="visible"]' },
    { absent: "#scroll-scrollbar" },
    { wheel: ["#scroll-viewport", 200] },
    { matches: '#scroll-scrollbar[data-state="visible"]' },
    { hover: "#always-viewport" },
    { absent: "#scroll-scrollbar" },
  ],
});
