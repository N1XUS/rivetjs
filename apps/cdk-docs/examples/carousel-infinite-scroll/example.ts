import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Infinite scroll",
  summary:
    "embla's Infinite Scroll example: reaching the last slide loads five more (mocked, up to 20); a custom watchSlides re-initialises embla and keeps the scroll momentum.",
  tags: ["carousel", "infinite", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#infinite", "data-ready", "true"] },
    { attr: ["#infinite-slide-0", "aria-label", "1 of 5"] },
    { click: "#next" },
    { click: "#next" },
    { click: "#next" },
    { click: "#next" },
    { click: "#next" },
    { attr: ["#loader", "data-loading", "true"] },
    { matches: "#infinite-slide-9" },
    { attr: ["#infinite-slide-0", "aria-label", "1 of 10"] },
  ],
});
