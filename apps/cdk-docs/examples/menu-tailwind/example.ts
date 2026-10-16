import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu with Tailwind",
  summary:
    "Tailwind classes through class, triggerClass, popoverClass and itemClass, with aria-expanded:, aria-disabled:, entering:, exiting: and placement-* variants.",
  tags: ["menu", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-trigger.rounded-md" },
    { click: "#tw-trigger" },
    { attr: ["#tw-trigger", "aria-expanded", "true"] },
    { matches: ".tw-popover.shadow-lg[data-placement=bottom]" },
    { matches: "#tw.grid" },
    { matches: '#tw [data-key="archive"].rounded' },
    { attr: ['[data-key="delete"]', "aria-disabled", "true"] },
    { key: "Escape" },
    { absent: ".tw-popover" },
    { attr: ["#tw-trigger", "aria-expanded", "false"] },
  ],
});
