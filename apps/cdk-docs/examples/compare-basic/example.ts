import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: before / after image",
  summary:
    "Two stacked layers and a draggable divider: the handle is an ARIA slider (drag it, or focus it and use the arrow keys); the after layer is clipped by an inline clip-path. Tailwind look, lucide grip.",
  tags: ["compare", "slider", "image", "motion", "tailwind"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#photo-handle", "role", "slider"] },
    { attr: ["#photo-handle", "aria-valuenow", "50"] },
    { attr: ["#photo-handle", "aria-valuetext", "50%"] },
    { matches: '#photo [data-rv-compare-after][style*="inset(0 0 0 50%)"]' },
    { press: ["#photo-handle", "ArrowRight"] },
    { attr: ["#photo-handle", "aria-valuenow", "51"] },
    { press: ["#photo-handle", "End"] },
    { attr: ["#photo-handle", "aria-valuenow", "100"] },
  ],
});
