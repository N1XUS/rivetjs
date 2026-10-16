import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: External Links and Force Reload",
  summary: "http(s) links open in a new tab (rel=noopener noreferrer); forceReload makes a full document load instead of client routing.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=navbar-item][href^='https']", "target", "_blank"] },
    { attr: ["[data-slot=navbar-item][href^='https']", "rel", "noopener noreferrer"] },
    { matches: "[data-slot=navbar-item][data-rivet-reload]" },
  ],
});
