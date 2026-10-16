import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: events",
  summary: "onExpandedChange (own toggles), onOpened / onClosed (every change, also a group closing it) and onDestroyed, logged.",
  tags: ["cdk", "accordion", "events"],
  status: "experimental",
  frame: { height: 197, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#log", "No events yet"] },
    { click: "#one button" },
    { expect: ["#log", "one expandedChange true, one opened"] },
    { click: "#two button" },
    { expect: ["#log", "two opened"] },
    { expect: ["#log", "one closed"] },
    { click: "#toggle-extra" },
    { matches: "#extra button" },
    { click: "#extra button" },
    { attr: ["#extra button", "aria-expanded", "true"] },
    { attr: ["#two button", "aria-expanded", "true"] },
    { click: "#toggle-extra" },
    { absent: "#extra" },
    { expect: ["#log", "extra destroyed"] },
  ],
});
