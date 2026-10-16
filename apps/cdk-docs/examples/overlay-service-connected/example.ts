import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Overlay service: connected position",
  summary:
    "A dropdown on flexibleConnectedTo(origin): preferred positions with fallbacks, a panel class per position, positionChanges, a DomPortal moved in and back, outside clicks close it.",
  tags: ["cdk", "overlay", "angular", "position"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/components/Dropdown.tsx", "src/styles.css"],
  test: [
    // The DomPortal content lives in the page until it is attached.
    { matches: "#oc-stash > #oc-menu" },
    { click: "#oc-trigger" },
    { matches: ".cdk-overlay-pane > #oc-menu" },
    { absent: "#oc-stash > #oc-menu" },
    { matches: ".cdk-overlay-connected-position-bounding-box > .cdk-overlay-pane.below" },
    { expect: ["#oc-log", "bottom→top"] },
    { attr: ["#oc-trigger", "aria-expanded", "true"] },
    // A click outside every overlay: outsidePointerEvents → detach; the element goes back.
    { click: "#oc-heading" },
    { absent: ".cdk-overlay-pane #oc-menu" },
    { matches: "#oc-stash > #oc-menu" },
    { attr: ["#oc-trigger", "aria-expanded", "false"] },
  ],
});
