import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Right-to-left carousel",
  summary: 'embla\'s Right To Left example: direction="rtl" under dir="rtl" mirrors the track, the buttons and the arrow keys.',
  tags: ["carousel", "rtl", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#rtl-wrapper", "dir", "rtl"] },
    { attr: ["#rtl-slide-0", "data-snapped", "true"] },
    { click: "#next" },
    { attr: ["#rtl-slide-1", "data-snapped", "true"] },
    { press: ["#next", "ArrowLeft"] },
    { attr: ["#rtl-slide-2", "data-snapped", "true"] },
    { click: "#rtl-tab-4" },
    { attr: ["#rtl-tab-4", "aria-selected", "true"] },
  ],
});
