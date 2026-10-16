import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Backdrop Variants",
  summary: "Opaque (default), blur and transparent backdrops.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(2)" },
    { matches: "[data-slot=sheet-dialog]" },
    { expect: ["[data-slot=sheet-heading]", "blur"] },
    { key: "Escape" },
    { absent: "[data-slot=sheet-dialog]" },
  ],
});
