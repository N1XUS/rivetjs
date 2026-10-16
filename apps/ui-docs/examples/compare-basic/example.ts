import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Compare: Usage",
  summary:
    "Rivet addition: a before / after image comparison. Drag the round handle (or focus it and use the arrow keys) to reveal the colour photo over the grayscale one.",
  tags: ["compare", "image", "slider", "motion"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#compare-basic-handle", "role", "slider"] },
    { attr: ["#compare-basic-handle", "aria-valuenow", "50"] },
    { press: ["#compare-basic-handle", "ArrowRight"] },
    { attr: ["#compare-basic-handle", "aria-valuenow", "51"] },
    { press: ["#compare-basic-handle", "Home"] },
    { attr: ["#compare-basic-handle", "aria-valuenow", "0"] },
    { attr: ["#compare-basic-handle", "aria-valuetext", "0%"] },
  ],
});
