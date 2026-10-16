import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabbed carousel with dots",
  summary:
    "tabs + CarouselDots: the W3C APG tabbed carousel. Slides become tab panels labelled by their dot; arrows, Home and End move between dots and select.",
  tags: ["carousel", "tabs", "tailwind", "keyboard"],
  status: "experimental",
  frame: { height: 214, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#seasons [role=tablist]", "aria-label", "Choose slide to display"] },
    { attr: ["#seasons-tab-0", "aria-selected", "true"] },
    { attr: ["#seasons-slide-0", "role", "tabpanel"] },
    { attr: ["#seasons-slide-0", "aria-labelledby", "seasons-tab-0"] },
    { press: ["#seasons-tab-0", "ArrowRight"] },
    { attr: ["#seasons-tab-1", "aria-selected", "true"] },
    { focused: "#seasons-tab-1" },
    { key: "End" },
    { attr: ["#seasons-slide-3", "data-snapped", "true"] },
    { click: "#seasons-tab-0" },
    { attr: ["#seasons-tab-0", "aria-selected", "true"] },
  ],
});
