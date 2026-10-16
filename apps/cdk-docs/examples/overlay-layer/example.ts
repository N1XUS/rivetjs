import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Your own modal on the overlay layer",
  summary:
    "Overlay (portal + focus scope), modalOverlay (Escape, outside press, scroll lock, inert outside), DismissButton and an overlay trigger state: a custom bottom sheet.",
  tags: ["cdk", "overlay", "modal", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/components/Sheet.tsx", "src/routes/index.tsx"],
  test: [
    { absent: "#sheet" },
    { click: "#sheet-open" },
    { matches: "body > [data-rivet-portal] #sheet" },
    { focused: "#sheet" },
    // inert outside, and the document does not scroll.
    { matches: "#sheet-open[inert]" },
    { matches: "html[style*='overflow: hidden']" },
    // Focus scope contain: Tab cycles inside.
    { key: "Tab" },
    { focused: "#sheet-close" },
    { key: "Tab" },
    { focused: "#sheet-close" },
    { key: "Escape" },
    { absent: "#sheet" },
    { focused: "#sheet-open" },
    { absent: "#sheet-open[inert]" },
    // Outside press (isDismissable): on the backdrop.
    { click: "#sheet-open" },
    { matches: "#sheet" },
    { click: "#sheet-backdrop" },
    { absent: "#sheet" },
  ],
});
