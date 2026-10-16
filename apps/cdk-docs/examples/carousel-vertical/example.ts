import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Vertical carousel",
  summary: 'axis="y" stacks the slides in a column: the viewport needs a height, drags and Arrow Up / Down move between slides.',
  tags: ["carousel", "orientation", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#steps", "data-orientation", "vertical"] },
    { press: ["#next", "ArrowDown"] },
    { attr: ["#steps-slide-1", "data-snapped", "true"] },
    { click: "#next" },
    { attr: ["#steps-slide-2", "data-snapped", "true"] },
    { press: ["#prev", "ArrowUp"] },
    { attr: ["#steps-slide-1", "data-snapped", "true"] },
  ],
});
