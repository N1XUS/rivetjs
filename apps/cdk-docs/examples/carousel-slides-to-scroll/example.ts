import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slides to scroll: auto",
  summary: 'embla\'s Slides To Scroll example: slidesToScroll="auto" groups as many slides as fit (two at 50%) into one snap.',
  tags: ["carousel", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#next" },
    { attr: ["#pairs-slide-2", "data-snapped", "true"] },
    { attr: ["#pairs-slide-3", "data-snapped", "true"] },
    { attr: ["#pairs-tab-1", "aria-selected", "true"] },
    { matches: "#pairs-tab-4" },
    { absent: "#pairs-tab-5" },
  ],
});
