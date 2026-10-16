import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter with plain CSS",
  summary: "styles.css targets .rv-Meter and its parts; a custom property set from the style render prop drives the fill.",
  tags: ["meter", "css", "styling"],
  status: "experimental",
  frame: { height: 108, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#battery", "class", "rv-Meter"] },
    { attr: ["#battery", "style", "--fill:35%"] },
    { attr: ["#low", "class", "rv-Meter low"] },
    { name: ["#low", "Backup battery"] },
  ],
});
