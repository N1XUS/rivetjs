import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup DOM events and attributes",
  summary: "Global DOM events and attributes on the CheckboxGroup div, on each CheckboxField div and on each CheckboxButton label.",
  tags: ["checkbox-group", "events", "dom"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#dom-cg", "lang", "it"] },
    { attr: ["label:has(input[value='rosso'])", "lang", "it-CH"] },
    { attr: [".rv-CheckboxField:has(input[value='rosso'])", "data-color", "red"] },
    { click: "label:has(input[value='rosso'])" },
    { expect: ["#dom-cg-log", "group:pointerenter"] },
    { expect: ["#dom-cg-log", "rosso:pointerenter"] },
    { matches: "input[value='rosso']:checked" },
    { dblclick: "label:has(input[value='rosso'])" },
    { expect: ["#dom-cg-log", "rosso:dblclick"] },
  ],
});
