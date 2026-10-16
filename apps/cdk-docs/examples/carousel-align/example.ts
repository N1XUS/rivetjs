import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Align and contain scroll",
  summary: "embla's Align example: 70% slides centred (align default) with containScroll off, so the first and last snaps leave space at the edges.",
  tags: ["carousel", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#align-slide-0", "data-snapped", "true"] },
    { attr: ["#prev", "data-disabled", "true"] },
    { click: "#next" },
    { attr: ["#align-slide-1", "data-snapped", "true"] },
    { matches: "#align-tab-4" },
  ],
});
