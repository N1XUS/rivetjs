import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tooltip with plain CSS",
  summary:
    "No utilities: rules for rv-Tooltip, rv-OverlayArrow and [data-placement], a data-entering animation from --trigger-anchor-point, and a zIndex through the Tooltip style prop.",
  tags: ["tooltip", "css"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { key: "Tab" },
    { attr: ["#tcss", "class", "rv-Tooltip"] },
    { matches: "#tcss > .rv-OverlayArrow" },
    // style wins over the engine's: z-index 50 instead of 100000.
    { matches: "#tcss[style*='z-index: 50']" },
    { key: "Tab" },
    { absent: "#tcss" },
  ],
});
