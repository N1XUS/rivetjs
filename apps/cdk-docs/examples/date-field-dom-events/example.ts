import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DateField: DOM events and attributes",
  summary: "Global DOM events and attributes on each part: the DateField root, the DateInput group and every DateSegment.",
  tags: ["aria", "date", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: [".rv-DateField", "lang", "en"] },
    { attr: [".rv-DateField", "translate", "no"] },
    { attr: ["#dom", "dir", "ltr"] },
    { attr: ["#dom-day", "lang", "en"] },
    { click: "#dom-day" },
    { expect: ["#log", "root-enter segment-enter:day input-up"] },
    { focused: "#dom-day" },
  ],
});
