import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Fade",
  summary: "embla's Fade example: the Fade plugin (@rivetjs/cdk/carousel/fade) stacks the slides and cross-fades them; drag, buttons and dots still work.",
  tags: ["carousel", "plugin", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#fade", "data-ready", "true"] },
    { matches: '#fade-slide-0[style*="opacity: 1"]' },
    { matches: '#fade-slide-1[style*="opacity: 0"]' },
    { click: "#next" },
    { attr: ["#fade-slide-1", "data-snapped", "true"] },
    { matches: '#fade-slide-1[style*="opacity: 1"]' },
    { matches: '#fade-slide-0[style*="opacity: 0"]' },
  ],
});
