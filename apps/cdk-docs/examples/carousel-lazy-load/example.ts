import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lazy load",
  summary: "embla's Lazy Load example: onApi collects slidesInView, and each slide renders its content (spinner until then) the first time it is in view.",
  tags: ["carousel", "lazy", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#lazy-slide-0 > div", "data-loaded", "true"] },
    { attr: ["#lazy-slide-2 > div", "data-loaded", null] },
    { click: "#next" },
    { attr: ["#lazy-slide-1 > div", "data-loaded", "true"] },
    { click: "#lazy-tab-4" },
    { attr: ["#lazy-slide-4 > div", "data-loaded", "true"] },
  ],
});
