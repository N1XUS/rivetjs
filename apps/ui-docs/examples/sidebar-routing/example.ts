import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: client-side routing",
  summary:
    "navigate on the provider routes menu links (here into a signal); isCurrent marks the page; forceReload loads a document; external links open a new tab.",
  tags: ["sidebar", "navigation", "routing"],
  status: "experimental",
  frame: { height: 360, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#srt-billing" },
    { expect: ["#srt-path", "/billing"] },
    { attr: ["#srt-billing", "aria-current", "page"] },
    { attr: ["#srt-legacy", "data-rivet-reload", ""] },
    { attr: ["#srt-status", "target", "_blank"] },
  ],
});
