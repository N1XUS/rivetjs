import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter DOM events and attributes",
  summary: "Global DOM events and attributes (onPointerEnter, lang, data-*) land on the meter element.",
  tags: ["meter", "dom-events"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#cpu", "data-source", "host-1"] },
    { attr: ["#cpu", "lang", "de-DE"] },
    { hover: "#cpu" },
    { expect: ["#cpu-log", "pointerenter"] },
    { dblclick: "#cpu" },
    { expect: ["#cpu-log", "dblclick"] },
  ],
});
