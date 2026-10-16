import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Auto height",
  summary: "embla's Auto Height example: the AutoHeight plugin (@rivetjs/cdk/carousel/auto-height) resizes the track to the tallest slide in view.",
  tags: ["carousel", "plugin", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#heights", "data-ready", "true"] },
    { matches: '#heights-viewport > div[style*="height: 160px"]' },
    { click: "#next" },
    { attr: ["#heights-slide-1", "data-snapped", "true"] },
    { matches: '#heights-viewport > div[style*="height: 224px"]' },
  ],
});
