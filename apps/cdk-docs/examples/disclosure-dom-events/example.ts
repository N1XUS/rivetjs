import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: DOM events",
  summary:
    "Global DOM events and attributes land on the Disclosure root (pointerenter, dblclick, contextmenu, lang, dir); onExpandedChange reports each toggle.",
  tags: ["cdk", "disclosure", "events"],
  status: "experimental",
  frame: { height: 102, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#colour", "lang", "en-GB"] },
    { attr: ["#colour", "dir", "ltr"] },
    { click: "#colour button" },
    { matches: "#colour[data-expanded]" },
    { expect: ["#log", "pointerenter"] },
    { expect: ["#log", "expanded: true"] },
    { click: "#colour button" },
    { matches: "#colour:not([data-expanded])" },
    { expect: ["#log", "expanded: false"] },
  ],
});
