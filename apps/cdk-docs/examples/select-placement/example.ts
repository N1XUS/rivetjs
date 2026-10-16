import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select placement",
  summary: "placement, offset, crossOffset, maxHeight and shouldFlip position the listbox popover; data-placement tells the side it took.",
  tags: ["select", "overlay", "placement"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#up-trigger" },
    { matches: "#up-popover[data-placement^=top]" },
    { key: "Escape" },
    { absent: "#up-popover" },
    { click: "#long-trigger" },
    { matches: "#long-popover[data-placement^=bottom]" },
    { matches: "#long-popover[style*='max-height: 120px']" },
  ],
});
