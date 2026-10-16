import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: Content",
  summary:
    "Any content compares, not only images: the same card in the light and the dark theme (data-theme on each layer), with the labels clipped by their layers.",
  tags: ["compare", "theme", "content"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#compare-content [data-slot=compare-before] > div", "data-theme", "light"] },
    { attr: ["#compare-content [data-slot=compare-after] > div", "data-theme", "dark"] },
    { press: ["#compare-content-handle", "ArrowLeft"] },
    { attr: ["#compare-content-handle", "aria-valuenow", "49"] },
  ],
});
