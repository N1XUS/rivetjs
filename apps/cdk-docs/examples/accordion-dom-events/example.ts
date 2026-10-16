import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Accordion: DOM events",
  summary: "Global DOM events and attributes on DisclosureGroup and Disclosure land on their root divs: pointerenter, click, dblclick, contextmenu, lang, dir.",
  tags: ["cdk", "accordion", "events"],
  status: "experimental",
  frame: { height: 110, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#docs", "lang", "en-GB"] },
    { attr: ["#colour", "dir", "ltr"] },
    { click: "#colour button" },
    { attr: ["#colour button", "aria-expanded", "true"] },
    { expect: ["#log", "group pointerenter"] },
    { expect: ["#log", "group pointerenter, disclosure pointerenter"] },
  ],
});
