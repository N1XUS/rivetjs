import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PortalProvider",
  summary:
    "PortalProvider sets the container of the Portals and overlays below it (React Aria UNSAFE_PortalProvider): a Portal and a Tooltip render in #panel-layer.",
  tags: ["portal", "overlay", "tooltip"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#panel-layer > [data-rivet-portal] > #pp-note" },
    // Keyboard focus opens the tooltip (no hover needed).
    { key: "Tab" },
    { focused: "#pp-button" },
    { matches: "#panel-layer #pp-tip" },
    { key: "Escape" },
    { absent: "#pp-tip" },
  ],
});
