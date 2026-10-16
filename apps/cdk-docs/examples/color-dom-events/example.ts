import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Color components: DOM events and attributes",
  summary: "Global DOM events and attributes (onDblClick, onContextMenu, onPointerEnter, lang, data-*) land on the root element of each color component.",
  tags: ["color-area", "color-swatch", "color-field", "dom-events", "tailwind"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { dblclick: "#dom-area" },
    { expect: ["#dom-log", "area dblclick"] },
    { rightclick: "#dom-swatch" },
    { expect: ["#dom-log", "swatch contextmenu"] },
    { hover: "#dom-field" },
    { expect: ["#dom-log", "field pointerenter"] },
    { attr: ["#dom-area", "lang", "de"] },
    { attr: ["#dom-swatch", "data-tone", "warm"] },
  ],
});
