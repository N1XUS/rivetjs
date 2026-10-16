import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Overlay service: global position",
  summary:
    "Angular CDK's Overlay service: create() a pane placed in the viewport (centered horizontally) with a backdrop, attach a TemplatePortal, close on backdrop click and Escape (keydownEvents).",
  tags: ["cdk", "overlay", "angular"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/components/Announce.tsx", "src/styles.css"],
  test: [
    { absent: ".cdk-overlay-pane" },
    { click: "#og-open" },
    { matches: ".cdk-overlay-container .cdk-global-overlay-wrapper > .cdk-overlay-pane #og-panel" },
    { matches: ".cdk-overlay-backdrop.cdk-overlay-dark-backdrop" },
    { expect: ["#og-panel", "Release 2.0"] },
    { expect: ["#og-log", "attached"] },
    { click: ".cdk-overlay-backdrop" },
    { absent: "#og-panel" },
    { expect: ["#og-log", "attached detached"] },
    { click: "#og-open" },
    { matches: "#og-panel" },
    { key: "Escape" },
    { absent: "#og-panel" },
    { expect: ["#og-log", "attached detached attached detached"] },
  ],
});
