import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollDispatcher and CdkScrollable",
  summary:
    "CdkScrollable registers an element with the shared ScrollDispatcher; scrolled() emits for any registered scrollable (or the document), ancestorScrolled() only for the ancestors of an element.",
  tags: ["scrolling", "scroll dispatcher"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#dispatch-status", "Not listening"] },
    { click: "#dispatch-listen" },
    { expect: ["#dispatch-status", "2 registered scrollables"] },
    { expect: ["#dispatch-ancestors", "ancestors of the marker: panel-a"] },
    { press: ["#panel-a", "PageDown"] },
    { expect: ["#dispatch-last", "scrolled(): panel-a"] },
    { expect: ["#dispatch-ancestor-last", "ancestorScrolled(): panel-a"] },
    { press: ["#panel-b", "PageDown"] },
    { expect: ["#dispatch-last", "scrolled(): panel-b"] },
    // panel-b is not an ancestor of the marker: ancestorScrolled() did not emit for it.
    { expect: ["#dispatch-ancestor-last", "ancestorScrolled(): panel-a"] },
  ],
});
